import React, { useState, useRef, useEffect } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase'; // Assuming db is exported from firebase.js
import supabase from '../supabase'; // Assuming supabase is exported from supabase.js
import '../styles/track-order.css';

const MovableTrackOrder = ({ order, onConfirmReceived, onClose }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [position, setPosition] = useState({ x: window.innerWidth - 360, y: 60 });
  const [dragging, setDragging] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const trackRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleStarClick = (star) => {
    setRating(star);
  };

  const handleStarHover = (star) => {
    setHoverRating(star);
  };

  const handleStarLeave = () => {
    setHoverRating(0);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    // Limit to 5 photos, each max 5MB
    const validFiles = files.filter(file => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024).slice(0, 5);
    setSelectedFiles(validFiles);
  };

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      alert('Please select a rating.');
      return;
    }
    setIsSubmitting(true);
    try {
      let photoURLs = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop().toLowerCase();
          const fileName = `${order.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('feedback-photos') // Assuming a bucket named 'feedback-photos'
            .upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('feedback-photos').getPublicUrl(fileName);
          photoURLs.push(publicUrl);
        }
      }

      const orderDocRef = doc(db, 'orders', order.id);
      await updateDoc(orderDocRef, {
        feedback: {
          rating,
          comments,
          photoURLs,
          submittedAt: new Date(),
        },
      });

      alert('Feedback submitted successfully!');
      // Reset form
      setRating(0);
      setComments('');
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          {order.status === 'completed' && (
            <div className="feedback-section">
              <h3>Rate Your Order</h3>
              {order.feedback ? (
                <div className="feedback-display">
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`star ${star <= order.feedback.rating ? 'filled' : ''}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {order.feedback.comments && (
                    <div className="feedback-comments-display">
                      <strong>Comments:</strong> {order.feedback.comments}
                    </div>
                  )}
                  {order.feedback.photoURLs && order.feedback.photoURLs.length > 0 && (
                    <div className="feedback-photos">
                      <strong>Photos:</strong>
                      <div className="photo-grid">
                        {order.feedback.photoURLs.map((url, index) => (
                          <img key={index} src={url} alt={`Feedback photo ${index + 1}`} className="feedback-photo" />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="feedback-submitted">
                    Feedback already submitted
                  </div>
                </div>
              ) : (
                <>
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`star ${star <= (hoverRating || rating) ? 'filled' : ''}`}
                        onClick={() => handleStarClick(star)}
                        onMouseEnter={() => handleStarHover(star)}
                        onMouseLeave={handleStarLeave}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <textarea
                    placeholder="Leave your comments here..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="feedback-comments"
                    rows="4"
                  />
                  <div className="photo-upload">
                    <label htmlFor="photo-input">Add Photos (optional, max 5):</label>
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="upload-btn"
                    >
                      Choose Files
                    </button>
                    {selectedFiles.length > 0 && (
                      <div className="selected-files">
                        {selectedFiles.map((file, index) => (
                          <span key={index}>{file.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSubmitFeedback}
                    className="submit-feedback-btn"
                    disabled={isSubmitting || rating === 0}
                    type="button"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MovableTrackOrder;