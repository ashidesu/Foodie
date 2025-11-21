import React, { useState } from 'react';
import '../styles/dish-overlay.css';

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

export default DishOverlay;