import React, { useState, useEffect, useCallback } from 'react';
import '../styles/restaurants.css';
import { useParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  Timestamp,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  limit,
  startAfter
} from 'firebase/firestore';
import supabase from '../supabase';
import MovablePaymentReview from './movable-payment-review.jsx';
import MovableTrackOrder from './movable-track-order.jsx';
import MovableCart from './cart.jsx';

// Helper: Check if restaurant is currently open based on openHours
const isRestaurantOpen = (openHours) => {
  if (!openHours) return false;

  const daysOfWeek = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

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

// DishCard component that opens overlay on plus button click
const DishCard = ({ dish, onOpenOverlay, isOpen }) => {
  const renderPrice = (price) => {
    if (typeof price === 'number') return `₱ ${price.toFixed(0)}`;
    if (typeof price === 'string')
      return price.trim().startsWith('₱') ? price.trim() : `₱ ${price.trim()}`;
    return 'Price N/A';
  };
  return (
    <div className="dish-card" tabIndex={0} aria-label={`Dish: ${dish.name}, Price: ${dish.price}`}>
      <div className="dish-image-container">
        <img
          src={dish.imageSrc || 'https://via.placeholder.com/150x150?text=No+Image'}
          alt={dish.name}
          className="dish-image"
          loading="lazy"
        />
        <button
          aria-label={`Open ${dish.name} details`}
          className="dish-add-btn"
          onClick={() => onOpenOverlay(dish.id)}
          disabled={!isOpen}
          type="button"
        >
          +
        </button>
      </div>
      <div className="dish-info">
        <h4 className="dish-name" title={dish.name}>{dish.name}</h4>
        <p className="dish-price">{renderPrice(dish.price)}</p>
        {dish.description && <p className="dish-desc" title={dish.description}>{dish.description}</p>}
      </div>
    </div>
  );
};

// DishOverlay component with quantity selector and Add to Cart button
const DishOverlay = ({ dish, onClose, onAddToCart, isOpen }) => {
  const [quantity, setQuantity] = useState(1);

  if (!dish) return null;

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  // Safe price formatting no decimals
  const renderPrice = (price) => {
    const n = Number(price);
    return isNaN(n) ? 'N/A' : `₱ ${n.toFixed(0)}`;
  };

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
          <p className="dish-description">{dish.description}</p>
          <p className="dish-price">{renderPrice(dish.price)}</p>
        </div>

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
            disabled={!isOpen}
          >
            Add to cart
          </button>
          {!isOpen && <p className="closed-message">Ordering is disabled because the restaurant is closed.</p>}
        </div>
      </div>
    </div>
  );
};

const RestaurantPage = () => {
  const { id: restaurantId } = useParams();

  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [overlayDishId, setOverlayDishId] = useState(null);
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showPaymentReview, setShowPaymentReview] = useState(false);
  const [showCart, setShowCart] = useState(true);
  const [popularDishes, setPopularDishes] = useState([]);
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  // Fetch the restaurant data
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const docRef = doc(db, 'restaurants', restaurantId);
        const restaurantDoc = await getDoc(docRef);
        if (restaurantDoc.exists()) {
          setRestaurant(restaurantDoc.data());
        } else {
          setError('Restaurant not found.');
        }
      } catch (err) {
        console.error('Error fetching restaurant:', err);
        setError('Failed to load restaurant data.');
      }
    };
    fetchRestaurant();
  }, [restaurantId]);

  // Fetch dishes
  useEffect(() => {
    const fetchDishes = async () => {
      try {
        if (!restaurantId) {
          setError('Invalid restaurant.');
          setLoading(false);
          return;
        }
        const dishesRef = collection(db, 'dishes');
        const q = query(dishesRef, where('restaurantId', '==', restaurantId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const dishesList = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          // Attempt get public image URL if imageUrl provided
          let imageSrc = '';
          if (data.imageUrl) {
            try {
              const { data: urlData } = supabase.storage.from('dishes').getPublicUrl(data.imageUrl);
              imageSrc = urlData?.publicUrl || '';
            } catch { }
          }
          dishesList.push({
            id: docSnap.id,
            name: data.name,
            category: data.category,
            price: data.price,
            description: data.description || '',
            imageSrc,
          });
        }
        setDishes(dishesList);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dishes:', err);
        setError('Error loading dishes.');
        setLoading(false);
      }
    };
    fetchDishes();
  }, [restaurantId]);

  // Fetch popular dishes based on orders
  useEffect(() => {
    const fetchPopularDishes = async () => {
      try {
        if (!restaurantId || dishes.length === 0) return;

        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('restaurantId', '==', restaurantId),
          where('status', 'in', ['pending', 'preparing', 'ready', 'out for delivery', 'completed']),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const dishCount = {};

        snapshot.forEach(docSnap => {
          const order = docSnap.data();
          order.items.forEach(item => {
            dishCount[item.id] = (dishCount[item.id] || 0) + item.quantity;
          });
        });

        // Map dishCount to dish data and sort descending by count and slice 6 max
        const popular = Object.entries(dishCount)
          .map(([id, count]) => {
            const dish = dishes.find(d => d.id === id);
            return dish ? { ...dish, count } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);

        setPopularDishes(popular);
      } catch (error) {
        console.error('Error fetching popular dishes:', error);
      }
    };
    fetchPopularDishes();
  }, [restaurantId, dishes]);

  // Fetch feedbacks and calculate average rating
  const fetchFeedbacks = useCallback(async (loadMore = false) => {
    try {
      setLoadingMore(true);
      const ordersRef = collection(db, 'orders');
      let q = query(
        ordersRef,
        where('restaurantId', '==', restaurantId),
        where('status', '==', 'completed'),
        orderBy('feedback.submittedAt', 'desc'),
        limit(5)
      );

      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      if (snapshot.docs.length < 5) {
        setHasMore(false);
      }

      const feedbacks = [];
      let totalRating = 0;
      let ratingCount = 0;
      const userIds = new Set();

      snapshot.forEach(docSnap => {
        const order = docSnap.data();
        if (order.feedback) {
          feedbacks.push({
            id: docSnap.id,
            userId: order.userId,
            rating: order.feedback.rating,
            comments: order.feedback.comments,
            photoURLs: order.feedback.photoURLs || [],
            submittedAt: order.feedback.submittedAt,
          });
          totalRating += order.feedback.rating;
          ratingCount += 1;
          userIds.add(order.userId);
        }
      });

      // Fetch user data for each unique userId
      const userPromises = Array.from(userIds).map(async (userId) => {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            userId,
            username: userData.username || userData.displayName || 'Anonymous',
            photoURL: userData.photoURL || '',
          };
        }
        return { userId, username: 'Anonymous', photoURL: '' };
      });

      const users = await Promise.all(userPromises);
      const userMap = users.reduce((map, user) => {
        map[user.userId] = user;
        return map;
      }, {});

      // Attach user data to feedbacks
      const feedbacksWithUsers = feedbacks.map(fb => ({
        ...fb,
        user: userMap[fb.userId] || { username: 'Anonymous', photoURL: '' },
      }));

      if (loadMore) {
        setRecentFeedbacks(prev => [...prev, ...feedbacksWithUsers]);
      } else {
        setRecentFeedbacks(feedbacksWithUsers);
        setAverageRating(ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0);
      }

      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [restaurantId, lastDoc]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Listen for user’s active order
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('userId', '==', user.uid),
      where('restaurantId', '==', restaurantId),
      where('active', '==', true)
    );

    const unsub = onSnapshot(q, snapshot => {
      if (!snapshot.empty) {
        const orderDoc = snapshot.docs[0];
        setCurrentOrder({ id: orderDoc.id, ...orderDoc.data() });
      } else {
        setCurrentOrder(null);
      }
    });

    return () => unsub();
  }, [restaurantId]);

  // Handlers
  const openOverlay = (dishId) => setOverlayDishId(dishId);
  const closeOverlay = () => setOverlayDishId(null);

  const handleAddToCart = (dishId, quantity = 1) => {
    setCart(prev => {
      const exist = prev.find(i => i.id === dishId);
      if (exist) {
        return prev.map(i => (i.id === dishId ? { ...i, quantity: i.quantity + quantity } : i));
      } else {
        const dish = dishes.find(d => d.id === dishId);
        if (!dish) return prev;
        return [...prev, { ...dish, quantity }];
      }
    });
    closeOverlay();
  };

  const handleUpdateQuantity = (dishId, newQuantity) => {
    setCart(prev => {
      if (newQuantity <= 0) {
        return prev.filter(i => i.id !== dishId);
      } else {
        return prev.map(i => i.id === dishId ? { ...i, quantity: newQuantity } : i);
      }
    });
  };

  const handleCancelOrder = () => setCart([]);

  const handleReviewPayment = () => {
    setShowCart(false);
    setShowPaymentReview(true);
  };

  const handleCancelPaymentReview = () => {
    setShowPaymentReview(false);
    setShowCart(true);
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
      items: cartItems.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      totalPrice,
      paymentMethod,
      status: 'pending',
      active: true,
      createdAt: Timestamp.now(),
      restaurantId,
    };
    try {
      const docRef = await addDoc(collection(db, 'orders'), orderPayload);
      setCurrentOrder({ ...orderPayload, id: docRef.id });
      setCart([]);
      setShowPaymentReview(false);
      setShowCart(true);
    } catch (error) {
      alert('Failed to submit order. Please try again.');
    }
  };

  const handleConfirmReceived = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'completed' });
    } catch {
      alert('Failed to confirm order. Please try again.');
    }
  };

  const handleCloseTrackOrder = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { active: false });
    } catch {
      alert('Failed to close order. Please try again.');
    }
  };

  const handleViewAllReviews = () => {
    setShowAllReviews(true);
  };

  const handleLoadMore = () => {
    fetchFeedbacks(true);
  };

  // Filtering and grouping
  const filteredDishes = dishes.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dishesByCategory = filteredDishes.reduce((acc, dish) => {
    acc[dish.category] = acc[dish.category] || [];
    acc[dish.category].push(dish);
    return acc;
  }, {});

  Object.keys(dishesByCategory).forEach(cat => {
    dishesByCategory[cat].sort((a, b) => b.price - a.price);
  });

  const categories = Object.entries(dishesByCategory).map(([category, arr]) => ({
    category, count: arr.length
  }));
  categories.unshift({ category: 'All', count: filteredDishes.length });

  const dishesToDisplay = selectedCategory === 'All' ? filteredDishes : dishesByCategory[selectedCategory] || [];

  const isOpen = restaurant ? isRestaurantOpen(restaurant.openHours) : false;

  // Find dish for overlay
  const dishInOverlay = dishes.find(d => d.id === overlayDishId);

  if (loading) return <div className="main-content">Loading...</div>;
  if (error) return <div className="main-content error-message">{error}</div>;

  const totalCartPrice = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const displayedFeedbacks = showAllReviews ? recentFeedbacks : recentFeedbacks.slice(0, 5);

  return (
    <main className="main-content restaurant-page-container" aria-label={`Restaurant page for ${restaurant?.name || ''}`}>
      {restaurant?.coverPhotoUrl && (
        <div className="cover-photo-banner">
          <img src={restaurant.coverPhotoUrl} alt={`${restaurant.name} Cover Banner`} loading="lazy" />
        </div>
      )}

      {!isOpen && (
        <section className="closed-notice" role="alert">
          <p>The restaurant is closed and is not accepting orders.</p>
        </section>
      )}

      {/* Restaurant Info with Rating */}
      <section className="restaurant-info" aria-label="Restaurant information">
        <h1 className="restaurant-name">{restaurant?.name || 'Restaurant'}</h1>
        <div className="rating-section">
          <div className="average-rating">
            <span className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`star ${star <= Math.floor(averageRating) ? 'filled' : ''}`}>
                  ★
                </span>
              ))}
            </span>
            <span className="rating-value">{averageRating} ({recentFeedbacks.length} reviews)</span>
          </div>
        </div>
      </section>

      {/* Recent Feedbacks */}
      {recentFeedbacks.length > 0 && (
        <section className="feedbacks-section" aria-label="Recent customer feedbacks">
          <h2>Recent Reviews</h2>
          <div className="feedbacks-grid">
            {displayedFeedbacks.map((feedback) => (
              <div key={feedback.id} className="feedback-card">
                <div className="feedback-user">
                  <img
                    src={feedback.user.photoURL || 'https://via.placeholder.com/40x40?text=U'}
                    alt={`${feedback.user.username} profile`}
                    className="user-avatar"
                  />
                  <span className="user-username">{feedback.user.username}</span>
                </div>
                <div className="feedback-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={`star ${star <= feedback.rating ? 'filled' : ''}`}>
                      ★
                    </span>
                  ))}
                </div>
                {feedback.comments && <p className="feedback-comments">{feedback.comments}</p>}
                {feedback.photoURLs.length > 0 && (
                  <div className="feedback-photos">
                    {feedback.photoURLs.slice(0, 3).map((url, index) => (
                      <img key={index} src={url} alt={`Feedback photo ${index + 1}`} className="feedback-photo" />
                    ))}
                  </div>
                )}
                <div className="feedback-date">
                  {new Date(feedback.submittedAt.seconds * 1000).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
          {!showAllReviews && recentFeedbacks.length >= 5 && (
            <button onClick={handleViewAllReviews} className="view-all-btn" type="button">
              View All Reviews
            </button>
          )}
          {showAllReviews && hasMore && (
            <button onClick={handleLoadMore} className="load-more-btn" disabled={loadingMore} type="button">
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          )}
        </section>
      )}

      {/* Search + Category Tabs */}
      <section className="search-category-container" aria-label="Search in menu and filter by categories">
        <input
          type="search"
          placeholder="Search in menu"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          aria-label="Search dishes"
          className="menu-search-input"
        />
        <nav className="category-tabs" role="tablist">
          {categories.map(({ category, count }) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`category-tab ${selectedCategory === category ? 'selected' : ''}`}
              aria-pressed={selectedCategory === category}
              role="tab"
              type="button"
            >
              {category} ({count})
            </button>
          ))}
        </nav>
      </section>

      {/* Popular Section */}
      {popularDishes.length > 0 && (
        <section className="popular-section" aria-label="Popular dishes section">
          <h2 className="popular-title">🔥 Popular</h2>
          <p className="popular-subtitle">Most ordered right now.</p>
          <div className="popular-dish-list">
            {popularDishes.map(dish => (
              <DishCard key={dish.id} dish={dish} onOpenOverlay={openOverlay} isOpen={isOpen} />
            ))}
          </div>
        </section>
      )}

      {/* Dishes grid grouped */}
      <section className="all-dishes-section" aria-label="All dishes grouped by category">
        {selectedCategory === 'All' ? (
          Object.entries(dishesByCategory).map(([category, dishes]) => (
            <article key={category} className="category-section">
              <h3 className="category-title">{category}</h3>
              <div className="category-dish-grid">
                {dishes.map(dish => (
                  <DishCard key={dish.id} dish={dish} onOpenOverlay={openOverlay} isOpen={isOpen} />
                ))}
              </div>
            </article>
          ))
        ) : (
          <article className="category-section">
            <h3 className="category-title">{selectedCategory}</h3>
            <div className="category-dish-grid">
              {dishesToDisplay.map(dish => (
                <DishCard key={dish.id} dish={dish} onOpenOverlay={openOverlay} isOpen={isOpen} />
              ))}
            </div>
          </article>
        )}
      </section>

      {/* Dish Overlay Modal */}
      {overlayDishId && dishInOverlay && (
        <DishOverlay dish={dishInOverlay} onClose={closeOverlay} onAddToCart={handleAddToCart} isOpen={isOpen} />
      )}

      {/* Movable Cart */}
      {showCart && (
        <MovableCart
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onCancel={handleCancelOrder}
          onAddOrder={handleReviewPayment}
          isOpen={isOpen}
        />
      )}

      {/* Payment Review */}
      {showPaymentReview && (
        <MovablePaymentReview
          cart={cart}
          cartTotal={totalCartPrice}
          deliveryFee={50}
          onConfirm={handleSubmitOrder}
          onCancel={handleCancelPaymentReview}
        />
      )}

      {/* Track Order */}
      {currentOrder && (
        <MovableTrackOrder
          order={currentOrder}
          onConfirmReceived={handleConfirmReceived}
          onClose={() => handleCloseTrackOrder(currentOrder.id)}
        />
      )}
    </main>
  );
};

export default RestaurantPage;