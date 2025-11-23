import React, { useState, useEffect, useRef } from 'react';
import '../styles/cart.css';

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
            {cart.map(({ id, name, quantity, price }) => (
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

export default MovableCart;