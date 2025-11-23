import React, { useState, useEffect } from 'react';
import '../styles/order-page.css';
import { db } from '../firebase'; 
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const daysOfWeek = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// Helper: Check if restaurant is currently open based on openHours
const isRestaurantOpen = (openHours) => {
  if (!openHours) return false;

  const now = new Date();
  const dayName = daysOfWeek[now.getDay()]; // Sunday = 0

  if (!openHours[dayName]?.enabled) return false;

  const openTimeStr = openHours[dayName].open || '09:00';
  const closeTimeStr = openHours[dayName].close || '17:30';

  // Parse hours and minutes
  const [openHour, openMinute] = openTimeStr.split(':').map(Number);
  const [closeHour, closeMinute] = closeTimeStr.split(':').map(Number);

  // Create Date objects for open and close today
  const openDate = new Date(now);
  openDate.setHours(openHour, openMinute, 0, 0);
  const closeDate = new Date(now);
  closeDate.setHours(closeHour, closeMinute, 0, 0);

  return now >= openDate && now <= closeDate;
};

const OrderPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const restaurantsQuery = collection(db, 'restaurants');
        const restaurantsSnapshot = await getDocs(restaurantsQuery);
        const restaurantsList = restaurantsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRestaurants(restaurantsList);
      } catch (fetchError) {
        console.error('Error fetching restaurants:', fetchError);
        setError('Failed to load restaurants. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  const handleRestaurantClick = (restaurantId) => {
    navigate(`/restaurant/${restaurantId}`);
  };

  if (loading) return <div className="order-page">Loading restaurants...</div>;
  if (error) return <div className="order-page"><p className="error-message">{error}</p></div>;

  return (
    <div className="order-page">
      <div className="order-container">
        {/* Other sections remain unchanged */}

        {/* All Restaurants */}
        <div className="section restaurants-section">
          <h3 className="section-title">All restaurants</h3>
          <div className="restaurants-grid">
            {restaurants.length === 0 ? (
              <p>No restaurants found.</p>
            ) : (
              restaurants.map((restaurant) => {
                const open = isRestaurantOpen(restaurant.openHours);

                return (
                  <div
                    key={restaurant.id}
                    className="restaurant-card"
                    onClick={() => handleRestaurantClick(restaurant.id)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleRestaurantClick(restaurant.id);
                    }}
                    role="button"
                    aria-label={`Open restaurant ${restaurant.name}`}
                  >
                    {/* Restaurant Photo */}
                    {restaurant.photoUrl ? (
                      <img
                        src={restaurant.photoUrl}
                        alt={`${restaurant.name} photo`}
                        className="restaurant-photo"
                      />
                    ) : (
                      <div className="restaurant-photo placeholder">
                        No Image
                      </div>
                    )}

                    {/* Name and Open Status */}
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