import React, { useState, useEffect, useRef } from 'react';
import '../styles/payment-review.css'; // Your CSS file for styling

const MovablePaymentReview = ({ cart, cartTotal, deliveryFee = 50, onConfirm, onCancel }) => {
  const [collapsed, setCollapsed] = useState(false); // Start expanded for review
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 100 }); // Position near right side
  const [dragging, setDragging] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('COD'); // Default to COD
  const dragOffset = useRef({ x: 0, y: 0 });
  const reviewRef = useRef(null);

  const grandTotal = cartTotal + deliveryFee;

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
    // For COD, proceed as before
    onConfirm(cart, grandTotal, selectedPayment);
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