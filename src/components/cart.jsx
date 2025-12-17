import React, { useState, useEffect, useRef } from 'react';
import '../styles/cart.css'
const MovableCart = ({ cart, onUpdateQuantity, onCancel, onAddOrder }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [position, setPosition] = useState({ x: 20, y: 60 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const cartRef = useRef(null);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * Number(item.price || 0), 0);

  const formatPrice = (price) => {
    const n = Number(price);
    return isNaN(n) ? 'N/A' : `₱ ${n.toFixed(0)}`;
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    const rect = cartRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const newX = Math.min(window.innerWidth - cartRef.current.offsetWidth, Math.max(0, e.clientX - dragOffset.current.x));
    const newY = Math.min(window.innerHeight - cartRef.current.offsetHeight, Math.max(0, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  };

  const onMouseUp = () => setDragging(false);

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
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed); }}
      >
        {collapsed ? (
          <div className="collapsed-info">
            <span>{totalItems} item{totalItems > 1 ? 's' : ''}</span>
            <span>&#8226;</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
        ) : (
          <span>Shopping Cart</span>
        )}
        <button
          aria-label={collapsed ? 'Expand cart' : 'Collapse cart'}
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
        <div className="cart-content">
          <ul className="cart-items-list">
            {cart.map(({ id, name, quantity, price, imageSrc, description }) => {
              const imageUrl = imageSrc || 'https://via.placeholder.com/80x80?text=No+Image';
              return (
                <li key={id} className="cart-item">
                  <img
                    src={imageUrl}
                    alt={name}
                    className="item-image"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/80x80?text=No+Image'; }}
                    loading="lazy"
                  />
                  <div className="item-details">
                    <h4 className="item-name">{name}</h4>
                    {description && <p className="item-desc">{description}</p>}
                    <div className="item-controls">
                      <span className="item-price">{formatPrice(price)}</span>
                      <div className="quantity-controls">
                        <button
                          aria-label={`Decrease quantity of ${name}`}
                          type="button"
                          onClick={() => quantity > 1 ? onUpdateQuantity(id, quantity - 1) : null}
                          className="qty-btn"
                        >
                          −
                        </button>
                        <span className="qty-value">{quantity}</span>
                        <button
                          aria-label={`Increase quantity of ${name}`}
                          type="button"
                          onClick={() => onUpdateQuantity(id, quantity + 1)}
                          className="qty-btn"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="cart-footer">
            <span className="cart-total-label">Total:</span>
            <span className="cart-total-value">{formatPrice(cartTotal)}</span>
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