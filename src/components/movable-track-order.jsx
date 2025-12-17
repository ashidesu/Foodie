import React, { useState, useRef, useEffect } from 'react';
import '../styles/track-order.css';

const MovableTrackOrder = ({ order, onConfirmReceived, onClose }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [position, setPosition] = useState({ x: window.innerWidth - 360, y: 60 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const trackRef = useRef(null);

  if (!order) return null;

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = order.totalPrice;

  // Drag event handlers
  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Left-click only
    setDragging(true);
    const rect = trackRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const newX = Math.min(window.innerWidth - trackRef.current.offsetWidth, Math.max(0, e.clientX - dragOffset.current.x));
    const newY = Math.min(window.innerHeight - trackRef.current.offsetHeight, Math.max(0, e.clientY - dragOffset.current.y));
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

  return (
    <div
      className={`movable-track-order ${collapsed ? 'collapsed' : 'expanded'}`}
      style={{ top: position.y, left: position.x }}
      ref={trackRef}
      role="complementary"
      aria-label="Track your order"
    >
      <div
        className="track-order-header"
        onMouseDown={onMouseDown}
        aria-grabbed={dragging}
        tabIndex={0}
        aria-label="Drag track order panel"
        role="button"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed);
        }}
      >
        {collapsed ? (
          <>
            <span>Order Status: <strong>{order.status}</strong></span>
            {(order.status === 'completed' || order.status === 'cancelled') && (
              <button
                aria-label="Close track order panel"
                onClick={onClose}
                className="close-btn"
                type="button"
              >
                ✕
              </button>
            )}
          </>
        ) : (
          <>
            <span>Order Summary and Status</span>
            {(order.status === 'completed' || order.status === 'cancelled') && (
              <button
                aria-label="Close track order panel"
                onClick={onClose}
                className="close-btn"
                type="button"
              >
                ✕
              </button>
            )}
          </>
        )}
        <button
          aria-label={collapsed ? 'Expand order summary' : 'Collapse order summary'}
          onClick={() => setCollapsed(!collapsed)}
          className="collapse-btn"
          type="button"
        >
          {collapsed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 14L12 9L7 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="track-order-content">
          <ul className="order-items-list">
            {order.items.map(({ id, name, quantity, price }) => (
              <li key={id} className="order-item">
                <span className="order-item-name">{name}</span>
                <span className="order-item-quantity">x{quantity}</span>
                <span className="order-item-subtotal">₱ {(quantity * price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="order-total">
            <span>Total Price:</span>
            <span>₱ {totalPrice.toFixed(2)}</span>
          </div>
          <div className="order-status">
            <strong>Status:</strong> {order.status}
          </div>
          {order.status === 'out for delivery' && (
            <button
              onClick={() => onConfirmReceived(order.id)}
              className="confirm-received-btn"
              type="button"
            >
              Confirm Order Received
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MovableTrackOrder;