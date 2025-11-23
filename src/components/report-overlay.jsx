// ReportOverlay.jsx
import React, { useState } from 'react';
import '../styles/report-overlay.css'; // Import the new CSS file

const ReportOverlay = ({ isOpen, onClose, onSubmit, videoId, currentUser }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportReasons = [
    "Harassment or bullying",
    "Hate speech or symbols",
    "Violence or dangerous organizations",
    "Nudity or sexual content",
    "False information",
    "Scams or fraud",
    "Intellectual property violation",
    "Suicide or self-harm",
    "Spam or misleading content",
    "Other"
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReason) {
      alert('Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        videoId,
        userId: currentUser?.uid || 'anonymous',
        reason: selectedReason,
        additionalDetails,
        timestamp: new Date()
      });
      alert('Report submitted successfully. Our team will review it shortly.');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="overlay">
      <div className="overlay-content">
        <div className="overlay-header">
          <h2>Report Video</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <p>Please select the reason for reporting this video:</p>
        <form onSubmit={handleSubmit}>
          <div className="report-options">
            {reportReasons.map((reason, index) => (
              <label key={index} className="report-option">
                <input
                  type="radio"
                  name="reportReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
          <div className="additional-details">
            <label htmlFor="additionalDetails">Additional details (optional):</label>
            <textarea
              id="additionalDetails"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Provide more information about your report..."
              rows="3"
            />
          </div>
          <div className="report-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !selectedReason}>
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportOverlay;