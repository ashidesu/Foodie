import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // Import getAuth for authentication
import '../styles/payment-review.css'; // Your CSS file for styling

const MovablePaymentReview = ({ cart, cartTotal, deliveryFee = 50, onConfirm, onCancel }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('COD');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [addressError, setAddressError] = useState('');
  const dragOffset = useRef({ x: 0, y: 0 });
  const reviewRef = useRef(null);

  const grandTotal = cartTotal + deliveryFee;

  // Fetch user address from Firebase
  useEffect(() => {
    const fetchUserAddress = async () => {
      try {
        setIsLoadingAddress(true);
        
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
          setAddressError('User not logged in');
          setIsLoadingAddress(false);
          return;
        }
        
        const userId = user.uid; // Use the logged-in user's ID
        
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const address = userData.address;
          if (address && typeof address === 'object') {
            // Assuming the address is an object with keys: Street, Barangay, City/Municipality, Province
            const formattedAddress = `${address.Street || ''}, ${address.Barangay || ''}, ${address['City/Municipality'] || ''}, ${address.Province || ''}`.trim();
            setDeliveryAddress(formattedAddress || 'No address found');
          } else {
            setDeliveryAddress(address || 'No address found');
          }
        } else {
          setAddressError('User data not found');
        }
      } catch (error) {
        console.error('Error fetching address:', error);
        setAddressError('Failed to load address');
      } finally {
        setIsLoadingAddress(false);
      }
    };

    fetchUserAddress();
  }, []);

  // Drag event handlers (unchanged)
  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Left-click only
    setDragging(true);
    const rect = reviewRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const newX = Math.min(window.innerWidth - reviewRef.current.offsetWidth, Math.max(0, e.clientX - dragOffset.current.x));
    const newY = Math.min(window.innerHeight - reviewRef.current.offsetHeight, Math.max(0, e.clientY - dragOffset.current.y));
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

  const handleConfirm = () => {
    onConfirm(cart, grandTotal, selectedPayment, deliveryAddress);
  };

  return (
    <div
      className={`movable-payment-review ${collapsed ? 'collapsed' : 'expanded'}`}
      style={{ top: position.y, left: position.x }}
      ref={reviewRef}
      role="dialog"
      aria-label="Review Payment Method"
    >
      <div
        className="review-header"
        onMouseDown={onMouseDown}
        aria-grabbed={dragging}
        tabIndex={0}
        aria-label="Drag payment review panel"
        role="button"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed);
        }}
      >
        <span>Review Payment Method</span>
        <button
          aria-label={collapsed ? 'Expand review' : 'Collapse review'}
          onClick={() => setCollapsed(!collapsed)}
          className="collapse-btn"
          type="button"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="review-content">
          <h3>Order Summary</h3>
          <ul className="review-items-list">
            {cart.map(({ id, name, quantity, price }) => (
              <li key={id} className="review-item">
                <span className="item-name">{name} x{quantity}</span>
                <span className="item-subtotal">₱ {(quantity * price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="review-totals">
            <div className="subtotal">
              <span>Subtotal:</span>
              <span>₱ {cartTotal.toFixed(2)}</span>
            </div>
            <div className="delivery-fee">
              <span>Delivery Fee:</span>
              <span>₱ {deliveryFee.toFixed(2)}</span>
            </div>
            <div className="grand-total">
              <span>Total:</span>
              <span>₱ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="delivery-address-section">
            <h4>Delivery Address</h4>
            {isLoadingAddress ? (
              <p className="address-loading">Loading address...</p>
            ) : addressError ? (
              <p className="address-error">{addressError}</p>
            ) : (
              <div className="address-display">
                <p>{deliveryAddress}</p>
                <button 
                  type="button" 
                  className="change-address-btn"
                  aria-label="Change delivery address"
                >
                  Change Address
                </button>
              </div>
            )}
          </div>

          <div className="payment-options">
            <h4>Select Payment Method</h4>
            <label>
              <input
                type="radio"
                value="COD"
                checked={selectedPayment === 'COD'}
                onChange={(e) => setSelectedPayment(e.target.value)}
              />
              Cash on Delivery (COD)
            </label>
            <label>
              <input
                type="radio"
                value="Gcash"
                checked={selectedPayment === 'Gcash'}
                onChange={(e) => setSelectedPayment(e.target.value)}
                disabled
              />
              Online Payment (Coming Soon)
            </label>
          </div>

          <div className="review-actions">
            <button 
              className="cancel-review-btn" 
              type="button" 
              onClick={onCancel}
              aria-label="Cancel review"
            >
              Cancel
            </button>
            <button
              className="confirm-order-btn"
              type="button"
              onClick={handleConfirm}
              aria-label="Confirm and place order"
            >
              Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovablePaymentReview;