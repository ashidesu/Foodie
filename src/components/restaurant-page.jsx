import React, { useState, useEffect } from 'react';
import '../styles/restaurants.css';  
import '../styles/dish-overlay.css';
import '../styles/cart.css';
import '../styles/track-order.css';
import { useParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, Timestamp, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import supabase from '../supabase';

import DishOverlay from './dish-overlay';
import MovableCart from './cart';
import MovableTrackOrder from './movable-track-order'; // Updated import to match the component name

const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

const RestaurantPage = () => {
  const { id: restaurantId } = useParams();

  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [overlayDishId, setOverlayDishId] = useState(null);
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);

  useEffect(() => {
    const fetchDishes = async () => {
      try {
        if (!restaurantId) {
          setError('Invalid restaurant.');
          setLoading(false);
          return;
        }
        const dishesRef = collection(db, 'dishes');
        const dishesQuery = query(
          dishesRef,
          where('restaurantId', '==', restaurantId),
          orderBy('createdAt', 'desc')
        );
        const dishesSnapshot = await getDocs(dishesQuery);
        const dishesList = [];

        for (const docSnap of dishesSnapshot.docs) {
          const dishData = docSnap.data();
          const { name, category, price, description, restaurantId, imageUrl, createdAt } = dishData;
          const dishId = docSnap.id;

          let publicImageUrl = '';
          if (imageUrl) {
            try {
              const { data: urlData } = supabase.storage.from('dishes').getPublicUrl(imageUrl);
              publicImageUrl = urlData?.publicUrl || '';
            } catch (urlError) {
              console.error('Error getting image URL:', urlError);
            }
          }

          dishesList.push({
            id: dishId,
            name,
            category,
            price,
            description,
            restaurantId,
            imageSrc: publicImageUrl,
            createdAt: createdAt?.toDate ? createdAt.toDate().toLocaleDateString() : 'Unknown',
          });
        }

        setDishes(dishesList);
      } catch (fetchError) {
        console.error('Error fetching dishes:', fetchError);
        setError('Failed to load dishes. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDishes();
  }, [restaurantId]);

  // Fetch and listen for user's active order in real-time
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) return; // No user, no order to fetch

    const ordersRef = collection(db, 'orders');
    const orderQuery = query(
      ordersRef,
      where('userId', '==', user.uid),
      where('restaurantId', '==', restaurantId),
      where('active', '==', true), // Only show active orders
      where('status', 'in', ['pending', 'preparing', 'ready', 'out for delivery', 'completed', 'cancelled']) // Include all relevant statuses
    );

    const unsubscribe = onSnapshot(orderQuery, (snapshot) => {
      if (!snapshot.empty) {
        const orderDoc = snapshot.docs[0]; // Assuming one active order per user per restaurant
        const orderData = orderDoc.data();
        // Do not auto-close for any status; let user manually close
        setCurrentOrder({ id: orderDoc.id, ...orderData });
      } else {
        setCurrentOrder(null);
      }
    }, (error) => {
      console.error('Error listening to order updates:', error);
    });

    return () => unsubscribe(); // Cleanup listener
  }, [restaurantId]);

  const openOverlay = (dishId) => setOverlayDishId(dishId);
  const closeOverlay = () => setOverlayDishId(null);

  const dishInOverlay = dishes.find(d => d.id === overlayDishId);

  // Add to cart merges by dish id only (no add-ons)
  const handleAddToCart = (dishId, quantity) => {
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.id === dishId);
      if (existingIdx !== -1) {
        const newCart = [...prevCart];
        newCart[existingIdx].quantity += quantity;
        return newCart;
      }
      const dish = dishes.find(d => d.id === dishId);
      if (!dish) return prevCart;
      return [...prevCart, { ...dish, quantity }];
    });
    closeOverlay();
  };

  const handleRemoveFromCart = (dishId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== dishId));
  };

  const handleCancelOrder = () => {
    setCart([]);
  };

  const handleSubmitOrder = async (cartItems, totalPrice) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      alert('You must be signed in to place an order.');
      return;
    }

    const orderPayload = {
      userId: user.uid,
      items: cartItems.map(({ id, name, quantity, price }) => ({
        id,
        name,
        quantity,
        price,
      })),
      totalPrice,
      status: 'pending',
      active: true, // Set active to true for new orders
      createdAt: Timestamp.now(),
      restaurantId,
    };

    try {
      const docRef = await addDoc(collection(db, 'orders'), orderPayload);
      setCurrentOrder({ ...orderPayload, id: docRef.id });
      setCart([]); // clear cart once order placed
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to submit order. Please try again.');
    }
  };

  const handleConfirmReceived = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'completed' });
    } catch (error) {
      console.error('Error confirming order received:', error);
      alert('Failed to confirm order. Please try again.');
    }
  };

  const handleCloseTrackOrder = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { active: false });
      // The onSnapshot listener will automatically set currentOrder to null since active is now false
    } catch (error) {
      console.error('Error closing track order:', error);
      alert('Failed to close track order. Please try again.');
    }
  };

  const filteredDishes = dishes.filter(dish =>
    dish.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dishesByCategory = filteredDishes.reduce((acc, dish) => {
    if (!acc[dish.category]) acc[dish.category] = [];
    acc[dish.category].push(dish);
    return acc;
  }, {});

  const categories = Object.entries(dishesByCategory).map(([category, items]) => ({
    category,
    count: items.length,
  }));

  categories.unshift({ category: 'All', count: filteredDishes.length });

  const dishesToDisplay =
    selectedCategory === 'All'
      ? filteredDishes
      : dishesByCategory[selectedCategory] || [];

  if (loading) return <div className="main-content">Loading dishes...</div>;
  if (error)
    return (
      <div className="main-content">
        <p className="error-message">{error}</p>
      </div>
    );

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  return (
    <div className="main-content restaurant-page-container">
      {/* Search and Category Tabs */}
      <div className="search-category-container">
        <input
          type="text"
          placeholder="Search in menu"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="menu-search-input"
        />
        <div className="category-tabs" role="tablist">
          {categories.map(({ category, count }) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`category-tab ${
                selectedCategory === category ? 'selected' : ''
              }`}
              aria-pressed={selectedCategory === category}
              type="button"
            >
              {category} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Category Heading & Description */}
      {selectedCategory !== 'All' && (
        <div className="category-description-section">
          <h2 className="category-title">{selectedCategory}</h2>
          <p className="category-description">
            {selectedCategory === 'Mains'
              ? 'Served with java rice & atchara'
              : 'Delicious dishes curated just for you'}
          </p>
        </div>
      )}

      {/* Dish grid */}
      {dishesToDisplay.length === 0 ? (
        <p>No dishes found for this category.</p>
      ) : (
        <div className="dish-grid">
          {dishesToDisplay.map(dish => (
            <div key={dish.id} className="dish-card">
              <div className="dish-image-container">
                <img
                  src={
                    dish.imageSrc ||
                    'https://via.placeholder.com/110x110?text=No+Image'
                  }
                  alt={dish.name}
                  className="dish-image"
                />
                <button
                  aria-label={`Add ${dish.name} to order`}
                  className="dish-add-btn"
                  onClick={() => openOverlay(dish.id)}
                  type="button"
                >
                  +
                </button>
              </div>
              <div className="dish-info">
                <h4 className="dish-name" title={dish.name}>
                  {dish.name}
                </h4>
                <p className="dish-price">₱ {dish.price}</p>
                <p className="dish-desc" title={dish.description}>
                  {truncateText(dish.description, 80)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dish overlay */}
      {overlayDishId && dishInOverlay && (
        <DishOverlay
          dish={dishInOverlay}
          onClose={closeOverlay}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Movable Cart Panel */}
      <MovableCart
        cart={cart}
        onRemove={handleRemoveFromCart}
        onCancel={handleCancelOrder}
        onAddOrder={() => handleSubmitOrder(cart, totalCartPrice)}
      />

      {/* Movable Track Order Panel */}
      {currentOrder && (
        <MovableTrackOrder
          order={currentOrder}
          onConfirmReceived={handleConfirmReceived}
          onClose={() => handleCloseTrackOrder(currentOrder.id)}
        />
      )}
    </div>
  );
};

export default RestaurantPage;