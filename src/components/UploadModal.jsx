import React from 'react';

const UploadModal = ({ isOpen, onClose, inputRef, type }) => {
  if (!isOpen) return null;

  const handleTakePhoto = async () => {
    // Close the current modal
    onClose();

    // Check if camera is supported and available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera not supported on this device.');
      return;
    }

    try {
      // Request camera access (front for selfie/selfie-with-id, back for others)
      const constraints = {
        video: {
          facingMode: type === 'selfie' || type === 'selfie-with-id' ? 'user' : 'environment'
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create a popup overlay for the camera
      const popup = document.createElement('div');
      popup.className = 'camera-popup';
      document.body.appendChild(popup);

      // Create a video element to display the stream
      const video = document.createElement('video');
      video.className = 'camera-video';
      video.srcObject = stream;
      video.play();
      popup.appendChild(video);

      // Add a capture button
      const captureButton = document.createElement('button');
      captureButton.className = 'camera-capture-button';
      captureButton.textContent = 'Capture Photo';
      captureButton.onclick = () => {
        // Create a canvas to capture the image
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Convert to blob and create a File
        canvas.toBlob((blob) => {
          const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });

          // Simulate setting the file to the input (this triggers onChange if set)
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          inputRef.current.files = dataTransfer.files;
          inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));

          // Stop the stream and remove popup
          stream.getTracks().forEach(track => track.stop());
          document.body.removeChild(popup);
        }, 'image/jpeg');
      };
      popup.appendChild(captureButton);

      // Add a close button
      const closeButton = document.createElement('button');
      closeButton.className = 'camera-close-button';
      closeButton.textContent = 'Close';
      closeButton.onclick = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(popup);
      };
      popup.appendChild(closeButton);

    } catch (error) {
      console.error('Error accessing camera:', error);
      if (error.name === 'NotReadableError') {
        alert('Camera is already in use or not accessible. Please close other apps using the camera and try again.');
      } else if (error.name === 'NotAllowedError') {
        alert('Camera access denied. Please grant permissions in your browser settings.');
      } else {
        alert('No camera detected or an error occurred. Please ensure your device has a camera.');
      }
    }
  };

  const handleUploadFromGallery = () => {
    inputRef.current.click();
    onClose();
  };

  return (
    <div className="upload-modal-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={e => e.stopPropagation()}>
        <h3>Choose Upload Method</h3>
        <button className="modal-btn take-photo" onClick={handleTakePhoto}>
          Take Photo
        </button>
        <button className="modal-btn upload-gallery" onClick={handleUploadFromGallery}>
          Upload from Gallery
        </button>
        <button className="modal-btn cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default UploadModal;