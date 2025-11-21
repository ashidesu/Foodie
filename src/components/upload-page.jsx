import React, { useState, useRef } from 'react';
import { Upload, Video, FileText, Monitor, Lightbulb } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // For generating video ID
import { db, auth } from '../firebase'; // Assuming Firebase is configured and exported
import { collection, addDoc } from 'firebase/firestore'; // Add this import for v9+ Firestore
import supabase from '../supabase.js'; // Assuming Supabase client is configured and exported

import '../styles/upload-page.css';

const UploadPage = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file) => {
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    } else {
      alert('Please select a valid video file');
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !caption.trim()) {
      alert('Please select a video and enter a caption');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert('You must be logged in to upload');
      return;
    }

    setIsUploading(true);

    try {
      const videoId = uuidv4();
      const uploaderId = user.uid;

      // Upload video to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${videoId}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos') // Assuming 'videos' is your bucket name
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Store metadata in Firebase Firestore (updated to v9+ syntax)
      await addDoc(collection(db, 'videos'), {
        id: videoId,
        uploaderId,
        caption,
        fileName,
        uploadedAt: new Date(),
        // Add other metadata as needed, e.g., size, duration
      });

      alert('Video uploaded successfully!');
      setSelectedFile(null);
      setCaption('');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-page-container">
      {/* Main Upload Area */}
      <div
        className={`upload-drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload Icon */}
        <div className="upload-icon-container">
          <svg
            className="upload-icon"
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="10" y="15" width="45" height="50" rx="4" fill="#d1d5db" />
            <polygon points="32.5,35 22,50 43,50" fill="#9ca3af" />
            <circle cx="24" cy="27" r="4" fill="#9ca3af" />
            <path
              d="M50 40 L60 30 L60 55 L50 55 Z"
              fill="#a8b3c1"
            />
            <path
              d="M45 25 L55 25 L55 35 L60 30 L55 25 L55 15 L45 15 Z"
              fill="#ff2d55"
            />
            <path
              d="M50 15 L50 35 M45 25 L55 25"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="upload-title">Select video to upload</h2>

        {/* Subtitle */}
        <p className="upload-subtitle">Or drag and drop it here</p>

        {/* Select Video Button */}
        <button
          className="select-video-button"
          onClick={handleButtonClick}
        >
          Select video
        </button>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileInputChange}
          className="hidden-file-input"
        />
      </div>

      {/* Caption Input */}
      {selectedFile && (
        <div className="caption-section">
          <label htmlFor="caption">Caption:</label>
          <input
            id="caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Enter a caption for your video"
          />
          <button
            className="upload-button"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>
      )}

      {/* Video Specifications Section */}
      <div className="specifications-grid">
        {/* Size and Duration */}
        <div className="spec-item">
          <Video size={20} className="spec-icon" />
          <div className="spec-content">
            <h3 className="spec-title">Size and duration</h3>
            <p className="spec-description">
              Maximum size: 30 GB, video duration: 60 minutes.
            </p>
          </div>
        </div>

        {/* File Formats */}
        <div className="spec-item">
          <FileText size={20} className="spec-icon" />
          <div className="spec-content">
            <h3 className="spec-title">File formats</h3>
            <p className="spec-description">
              Recommended: ".mp4". Other major formats are supported.
            </p>
          </div>
        </div>

        {/* Video Resolutions */}
        <div className="spec-item">
          <Monitor size={20} className="spec-icon" />
          <div className="spec-content">
            <h3 className="spec-title">Video resolutions</h3>
            <p className="spec-description">
              High-resolution recommended: 1080p, 1440p, 4K.
            </p>
          </div>
        </div>

        {/* Aspect Ratios */}
        <div className="spec-item">
          <Lightbulb size={20} className="spec-icon" />
          <div className="spec-content">
            <h3 className="spec-title">Aspect ratios</h3>
            <p className="spec-description">
              Recommended: 16:9 for landscape, 9:16 for vertical.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;