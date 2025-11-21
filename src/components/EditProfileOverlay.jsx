import React, { useState, useRef } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import supabase from '../supabase';
import '../styles/edit-profile-overlay.css'; // Import the CSS file below

const EditProfileOverlay = ({ user, dbUser, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    username: dbUser?.username || '',
    displayname: dbUser?.displayname || '',
    pronouns: dbUser?.pronouns || '',
    city: dbUser?.city || '',
    province: dbUser?.province || '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(dbUser?.photoURL || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelection = (file) => {
    if (file && file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) { // 5MB limit
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      alert('Please select a valid image file (max 5MB)');
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
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

  const handleSave = async () => {
    if (!user) {
      alert('You must be logged in');
      return;
    }

    setIsUploading(true);
    try {
      let photoURL = dbUser?.photoURL || null;

      // Upload new profile picture if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.uid}.${fileExt}`; // Updated: Use only the logged-in user ID as the filename
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
        photoURL = publicUrl;
      }

      // Update Firestore document
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        ...formData,
        photoURL,
      });

      // Notify parent to update state
      onUpdate({ ...formData, photoURL });

      alert('Profile updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="edit-profile-overlay">
      <div className="overlay-content">
        <button className="close-button" onClick={onClose}>×</button>
        <h2>Edit Profile</h2>

        <div className="form-group">
          <label>Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Enter username"
          />
        </div>

        <div className="form-group">
          <label>Display Name:</label>
          <input
            type="text"
            name="displayname"
            value={formData.displayname}
            onChange={handleInputChange}
            placeholder="Enter display name"
          />
        </div>

        <div className="form-group">
          <label>Pronouns:</label>
          <input
            type="text"
            name="pronouns"
            value={formData.pronouns}
            onChange={handleInputChange}
            placeholder="e.g., he/him, she/her"
          />
        </div>

        <div className="form-group">
          <label>City:</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            placeholder="Enter city"
          />
        </div>

        <div className="form-group">
          <label>Province:</label>
          <input
            type="text"
            name="province"
            value={formData.province}
            onChange={handleInputChange}
            placeholder="Enter province"
          />
        </div>

        <div className="form-group">
          <label>Profile Picture:</label>
          <div
            className={`image-upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="image-preview" />
            ) : (
              <div className="upload-placeholder">Drag & drop or click to select image</div>
            )}
            <button type="button" onClick={handleButtonClick}>Select Image</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="button-group">
          <button onClick={onClose} disabled={isUploading}>Cancel</button>
          <button onClick={handleSave} disabled={isUploading}>
            {isUploading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileOverlay;
