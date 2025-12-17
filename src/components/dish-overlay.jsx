import React, { useState } from 'react';

const DishOverlay = ({ dish, onClose, onAddToCart, isOpen }) => {
  const [quantity, setQuantity] = useState(1);

  if (!dish) return null;

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  // Safe price formatting: no decimals in your example
  const renderPrice = (price) => {
    const n = Number(price);
    return isNaN(n) ? 'N/A' : `₱ ${n.toFixed(0)}`;
  };

  return (
    <div
      className="overlay-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dish-title"
      tabIndex={-1}
    >
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
          <p className="dish-extra-desc" title={dish.extraDescription || ''}>
            {dish.extraDescription}
          </p>
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

export default DishOverlay;