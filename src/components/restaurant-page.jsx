import React, { useState, useEffect, useRef } from 'react';
import '../styles/cart.css';
import '../styles/restaurants.css';  
import '../styles/dish-overlay.css';
import '../styles/track-order.css';
import '../styles/payment-review.css';
import { useParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, Timestamp, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import supabase from '../supabase';
import MovablePaymentReview from './movable-payment-review.jsx';
import MovableTrackOrder from './movable-track-order.jsx';

// MovableCart Component
const MovableCart = ({ cart, onRemove, onCancel, onAddOrder }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [position, setPosition] = useState({ x: 20, y: 60 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const cartRef = useRef(null);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Drag event handlers
  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Left-click only
    setDragging(true);
    const rect = cartRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const newX = Math.min(window.innerWidth - cartRef.current.offsetWidth, Math.max(0, e.clientX - dragOffset.current.x));
    const newY = Math.min(window.innerHeight - cartRef.current.offsetHeight, Math.max(0, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  };

  const onMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  if (cart.length === 0) return null;

  return (
    <div
      className={`movable-cart ${collapsed ? 'collapsed' : 'expanded'}`}
      style={{ top: position.y, left: position.x }}
      ref={cartRef}
      role="complementary"
      aria-label="Shopping cart"
    >
      <div
        className="cart-header"
        onMouseDown={onMouseDown}
        aria-grabbed={dragging}
        tabIndex={0}
        aria-label="Drag shopping cart panel"
        role="button"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed);
        }}
      >
        {collapsed ? (
          <>
            <span>{totalItems} item{totalItems > 1 ? 's' : ''}</span>
            <span>&#8226;</span>
            <span>₱ {cartTotal.toFixed(2)}</span>
          </>
        ) : (
          <span>Shopping Cart</span>
        )}
        <button
          aria-label={collapsed ? 'Expand cart' : 'Collapse cart'}
          onClick={() => setCollapsed(!collapsed)}
          className="collapse-btn"
          type="button"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="cart-content">
          <ul className="cart-items-list">
            {cart.map(({ id, name, quantity, price,imageSrc }) => (
              <li key={id} className="cart-item">
                <div className="item-info">
                  <span className="item-name">{name}</span>
                  <span className="item-quantity">x{quantity}</span>
                  <span className="item-subtotal">₱ {(quantity * price).toFixed(2)}</span>
                </div>
                <button
                  aria-label={`Remove ${name} from cart`}
                  className="remove-btn"
                  onClick={() => onRemove(id)}
                  type="button"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="cart-footer">
            <span className="cart-total-label">Total:</span>
            <span className="cart-total-value">₱ {cartTotal.toFixed(2)}</span>
          </div>

          <div className="cart-actions">
            <button 
              className="cancel-order-btn" 
              type="button" 
              onClick={onCancel}
              aria-label="Cancel entire order"
            >
              Cancel Order
            </button>

            <button
              className="add-order-btn"
              type="button"
              onClick={() => onAddOrder(cart, cartTotal)}
              aria-label="Add order"
            >
              Review Payment Method
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// DishOverlay Component
const DishOverlay = ({ dish, onClose, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);

  if (!dish) return null;

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  return (
    <div className="overlay-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="dish-title" tabIndex={-1}>
      <div className="overlay-container" onClick={e => e.stopPropagation()}>
        <button
          className="overlay-close-btn"
          onClick={onClose}
          aria-label="Close dish details"
          type="button"
        >
          ×
        </button>

        <img
          src={dish.imageSrc || 'https://via.placeholder.com/360x240?text=No+Image'}
          alt={dish.name}
          className="overlay-image"
          loading="lazy"
        />

        <div className="dish-info-section">
          <h2 id="dish-title" className="dish-name">{dish.name}</h2>
          <p className="dish-price">₱ {dish.price}</p>
          <p className="dish-description">{dish.description}</p>
        </div>

        {/* Quantity selector and Add to Cart button in fixed footer */}
        <div className="overlay-footer">
          <div className="quantity-selector">
            <button type="button" onClick={decrement} aria-label="Decrease quantity" className="qty-btn">−</button>
            <span className="qty-value" aria-live="polite">{quantity}</span>
            <button type="button" onClick={increment} aria-label="Increase quantity" className="qty-btn">+</button>
          </div>
          <button
            type="button"
            className="add-to-cart-btn"
            onClick={() => onAddToCart(dish.id, quantity)}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
};

// Main RestaurantPage Component
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
  const [showPaymentReview, setShowPaymentReview] = useState(false);
  const [showCart, setShowCart] = useState(true); // Add state for cart visibility

  const truncateText = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

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

  // FIXED: Add to cart function - now properly handles quantity without doubling
  const handleAddToCart = (dishId, quantity) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === dishId);
      
      if (existingItem) {
        // If item already exists, update the quantity
        return prevCart.map(item =>
          item.id === dishId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // If item doesn't exist, add it to cart
        const dish = dishes.find(d => d.id === dishId);
        if (!dish) return prevCart;
        return [...prevCart, { ...dish, quantity }];
      }
    });
    closeOverlay();
  };

  const handleRemoveFromCart = (dishId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== dishId));
  };

  const handleCancelOrder = () => {
    setCart([]);
  };

  const handleReviewPayment = () => {
    setShowCart(false); // Hide cart when opening payment review
    setShowPaymentReview(true);
  };

  const handleCancelPaymentReview = () => {
    setShowPaymentReview(false);
    setShowCart(true); // Show cart again when canceling payment review
  };

  const handleSubmitOrder = async (cartItems, totalPrice, paymentMethod) => {
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
      paymentMethod, // Add payment method
      status: 'pending',
      active: true,
      createdAt: Timestamp.now(),
      restaurantId,
    };

    try {
      const docRef = await addDoc(collection(db, 'orders'), orderPayload);
      setCurrentOrder({ ...orderPayload, id: docRef.id });
      setCart([]);
      setShowPaymentReview(false); // Close review after submission
      setShowCart(true); // Show cart again after order is submitted
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

      {/* Movable Cart Panel - conditionally rendered */}
      {showCart && (
        <MovableCart
          cart={cart}
          onRemove={handleRemoveFromCart}
          onCancel={handleCancelOrder}
          onAddOrder={handleReviewPayment}
        />
      )}

      {/* Movable Payment Review Panel */}
      {showPaymentReview && (
        <MovablePaymentReview
          cart={cart}
          cartTotal={totalCartPrice}
          deliveryFee={50}
          onConfirm={handleSubmitOrder}
          onCancel={handleCancelPaymentReview}
        />
      )}

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