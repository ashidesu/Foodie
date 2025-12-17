import React, { useState, useEffect } from 'react';
import '../styles/order-page.css';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { useNavigate, Navigate } from 'react-router-dom';

const daysOfWeek = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// Helper to check open hours
const isRestaurantOpen = (openHours) => {
  if (!openHours) return false;

  const now = new Date();
  const dayName = daysOfWeek[now.getDay()];

  if (!openHours[dayName]?.enabled) return false;

  const openTimeStr = openHours[dayName].open || '09:00';
  const closeTimeStr = openHours[dayName].close || '17:30';

  const [openHour, openMinute] = openTimeStr.split(':').map(Number);
  const [closeHour, closeMinute] = closeTimeStr.split(':').map(Number);

  const openDate = new Date(now);
  openDate.setHours(openHour, openMinute, 0, 0);
  const closeDate = new Date(now);
  closeDate.setHours(closeHour, closeMinute, 0, 0);

  return now >= openDate && now <= closeDate;
};

const OrderPage = () => {
  if (!auth.currentUser) {
    return <Navigate to="/login" />;
  }

  if (auth.currentUser.isAnonymous) {
    const navigate = useNavigate();
    return (
      <div className="order-page">
        <div className="anonymous-message">
          <p>This feature is not available for anonymous users.</p>
          <button className="login-button" onClick={() => navigate('/login')}>
            Log In to Access
          </button>
        </div>
      </div>
    );
  }

  const [restaurants, setRestaurants] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [topBrands, setTopBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const restaurantsQuery = collection(db, 'restaurants');
        const restaurantsSnapshot = await getDocs(restaurantsQuery);
        const restaurantsList = restaurantsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRestaurants(restaurantsList);

        const userId = auth.currentUser.uid;
        const ordersQuery = query(
          collection(db, 'orders'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(3)
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        const recentOrderIds = ordersSnapshot.docs.map(doc => doc.data().restaurantId);
        const uniqueRecentIds = [...new Set(recentOrderIds)];
        const recentRestaurants = restaurantsList.filter(r => uniqueRecentIds.includes(r.id));
        setRecentOrders(recentRestaurants);

        const sortedByRating = [...restaurantsList].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        setTopBrands(sortedByRating.slice(0, 7)); // Fetch 7 for a fuller example

      } catch (fetchError) {
        console.error('Error fetching data:', fetchError);
        if (fetchError.code === 'failed-precondition') {
          setError('Database query requires an index. Please create it in Firebase Console.');
        } else {
          setError('Failed to load data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRestaurantClick = (restaurantId) => {
    navigate(`/restaurant/${restaurantId}`);
  };

  if (loading) return <div className="order-page">Loading...</div>;
  if (error) return <div className="order-page"><p className="error-message">{error}</p></div>;

  return (
    <div className="order-page">
      <div className="order-container">

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <div className="section recent-orders-section">
            <h3 className="section-title">Recent Orders</h3>
            <div className="restaurants-grid">
              {recentOrders.map((restaurant) => {
                const open = isRestaurantOpen(restaurant.openHours);
                const photoUrl = restaurant.displayPhotoUrl || restaurant.photoURLs?.displayURL;

                return (
                  <div
                    key={restaurant.id}
                    className="restaurant-card"
                    onClick={() => handleRestaurantClick(restaurant.id)}
                    tabIndex={0}
                    onKeyPress={e => { if(e.key === 'Enter') handleRestaurantClick(restaurant.id); }}
                    role="button"
                    aria-label={`Open restaurant ${restaurant.name}`}
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={`${restaurant.name} photo`}
                        className="restaurant-photo"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="restaurant-photo placeholder">No Image</div>
                    )}

                    <div className="restaurant-info">
                      <h4 className="restaurant-name">{restaurant.name}</h4>
                      <div className={`restaurant-status ${open ? 'open' : 'closed'}`}>
                        {open ? 'Open Now' : 'Closed'}
                        <span className={`status-indicator ${open ? 'green' : 'red'}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Brands / Cuisines */}
        <div className="section top-brands-section">
          <h3 className="section-title">Cuisines</h3>
          <div className="top-brands-scroll-container" role="list">
            {topBrands.map((restaurant) => {
              const photoUrl = restaurant.displayPhotoUrl || restaurant.photoURLs?.displayURL;
              const label = restaurant.name.length > 15 ? restaurant.name.slice(0, 15) + '...' : restaurant.name;

              return (
                <div
                  key={restaurant.id}
                  className="cuisine-card"
                  onClick={() => handleRestaurantClick(restaurant.id)}
                  role="listitem button"
                  tabIndex={0}
                  onKeyPress={e => { if (e.key === 'Enter') handleRestaurantClick(restaurant.id); }}
                  aria-label={`Open cuisine ${restaurant.name}`}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`${restaurant.name} cuisine`}
                      className="cuisine-photo"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="cuisine-photo placeholder">No Image</div>
                  )}
                  <div className="cuisine-label">{label}</div>
                </div>
              );
            })}
          </div>

          {/* Scroll right arrow */}
          <div
            className="top-brands-scroll-arrow"
            onClick={() => {
              const container = document.querySelector('.top-brands-scroll-container');
              if (container) {
                container.scrollBy({ left: 100, behavior: 'smooth' });
              }
            }}
            role="button"
            tabIndex={0}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                const container = document.querySelector('.top-brands-scroll-container');
                if (container) {
                  container.scrollBy({ left: 100, behavior: 'smooth' });
                }
              }
            }}
            aria-label="Scroll cuisines right"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9.29 6.71a1 1 0 1 0-1.42 1.42L12.17 12l-4.3 4.29a1 1 0 1 0 1.42 1.42l5-5a1 1 0 0 0 0-1.42l-5-5z" />
            </svg>
          </div>
        </div>

        {/* All Restaurants */}
        <div className="section restaurants-section">
          <h3 className="section-title">All Restaurants</h3>
          <div className="restaurants-grid">
            {restaurants.length === 0 ? (
              <p>No restaurants found.</p>
            ) : (
              restaurants.map((restaurant) => {
                const open = isRestaurantOpen(restaurant.openHours);
                const photoUrl = restaurant.displayPhotoUrl || restaurant.photoURLs?.displayURL;

                return (
                  <div
                    key={restaurant.id}
                    className="restaurant-card"
                    onClick={() => handleRestaurantClick(restaurant.id)}
                    tabIndex={0}
                    onKeyPress={e => { if(e.key === 'Enter') handleRestaurantClick(restaurant.id); }}
                    role="button"
                    aria-label={`Open restaurant ${restaurant.name}`}
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={`${restaurant.name} photo`}
                        className="restaurant-photo"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="restaurant-photo placeholder">No Image</div>
                    )}

                    <div className="restaurant-info">
                      <h4 className="restaurant-name">{restaurant.name}</h4>
                      <div className={`restaurant-status ${open ? 'open' : 'closed'}`}>
                        {open ? 'Open Now' : 'Closed'}
                        <span className={`status-indicator ${open ? 'green' : 'red'}`} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderPage;