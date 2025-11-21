import React, { useState, useEffect } from 'react';
import '../styles/order-page.css';
import { db } from '../firebase'; 
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

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
    // Navigate to menu page for selected restaurant
    navigate(`/restaurant/${restaurantId}`);
  };

  if (loading) return <div className="order-page">Loading restaurants...</div>;
  if (error) return <div className="order-page"><p className="error-message">{error}</p></div>;

  return (
    <div className="order-page">
      <div className="order-container">
        {/* ...Other sections remain unchanged... */}

        {/* All Restaurants */}
        <div className="section restaurants-section">
          <h3 className="section-title">All restaurants</h3>
          <div className="restaurants-grid">
            {restaurants.length === 0 ? (
              <p>No restaurants found.</p>
            ) : (
              restaurants.map((restaurant) => (
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
                  <h4>{restaurant.name}</h4>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPage;