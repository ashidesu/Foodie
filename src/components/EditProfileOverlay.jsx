import React, { useState, useRef, useEffect } from 'react';
import { updateDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import supabase from '../supabase';
import '../styles/edit-profile-overlay.css';

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
  const [usernameError, setUsernameError] = useState('');
  const [usernameWarning, setUsernameWarning] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const fileInputRef = useRef(null);

  // Helper to compare form data with original data
  const isFormDataEqual = (a, b) => (
    a.username === b.username &&
    a.displayname === b.displayname &&
    a.pronouns === b.pronouns &&
    a.city === b.city &&
    a.province === b.province
  );

  // Determine if there are changes compared to dbUser and photo
  const hasChanges = (!isFormDataEqual(formData, {
    username: dbUser?.username || '',
    displayname: dbUser?.displayname || '',
    pronouns: dbUser?.pronouns || '',
    city: dbUser?.city || '',
    province: dbUser?.province || '',
  }) || Boolean(selectedFile)) && !usernameError && !usernameWarning;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'username') {
      // Convert to lowercase and remove invalid characters
      const sanitized = value.toLowerCase().replace(/[^a-z0-9.]/g, '');
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
      // Check for invalid characters in original value
      if (value !== sanitized) {
        setUsernameWarning('Only letters, numbers, and periods are allowed.');
      } else {
        setUsernameWarning('');
      }
      setUsernameError(''); // Reset error on change
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleUsernameBlur = async () => {
    if (!formData.username.trim() || usernameWarning) return;
    setIsCheckingUsername(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', formData.username.trim()));
      const querySnapshot = await getDocs(q);
      const exists = querySnapshot.docs.some(doc => doc.id !== user.uid); // Exclude current user
      if (exists) {
        setUsernameError('Username already exists');
      } else {
        setUsernameError('');
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameError('Error checking username');
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleFileSelection = (file) => {
    if (file && file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
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
    if (!user || !user.uid) {
      alert('You must be logged in');
      console.error('User or user.uid is missing:', user);
      return;
    }

    if (usernameError || usernameWarning) {
      alert('Please fix the username issues before saving.');
      return;
    }

    setIsUploading(true);
    try {
      let photoURL = dbUser?.photoURL || null;

      if (selectedFile) {
        if (dbUser?.photoURL) {
          try {
            const url = new URL(dbUser.photoURL);
            const pathParts = url.pathname.split('/');
            const oldFilename = pathParts[pathParts.length - 1].split('?')[0];
            if (oldFilename) {
              const { error: deleteError } = await supabase.storage.from('profile-pictures').remove([oldFilename]);
              if (deleteError) console.error('Error deleting old profile picture:', deleteError);
            }
          } catch {}
        }

        const fileExt = selectedFile.name.split('.').pop().toLowerCase();
        const fileName = `${user.uid}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, selectedFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
        photoURL = publicUrl;
      }

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { ...formData, photoURL });

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
      <div className="overlay-content-profile">
        <button className="close-button" onClick={onClose} disabled={isUploading}>×</button>
        <h1>Edit profile</h1>

        <div className="form-group">
          <label className="field-label">Profile photo</label>
          <div
            className={`image-upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleButtonClick}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Profile preview" className="image-preview" />
            ) : (
              <div className="upload-placeholder">No image</div>
            )}
            <div className="edit-icon" title="Edit profile photo">
              ✎
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <hr className="divider" />

        <div className="form-group">
          <label className="field-label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            onBlur={handleUsernameBlur}
            placeholder="username"
            autoComplete="off"
            className={(usernameError || usernameWarning) ? 'error' : ''}
            disabled={isCheckingUsername}
          />
          {isCheckingUsername && <div className="help-text">Checking username...</div>}
          {usernameWarning && <div className="error-text">{usernameWarning}</div>}
          {usernameError && <div className="error-text">{usernameError}</div>}
          <div className="help-text">
            Usernames can only contain letters, numbers, underscores, and periods. Changing your username will also change your profile link.
          </div>
        </div>

        <hr className="divider" />

        <div className="form-group">
          <label className="field-label" htmlFor="displayname">Name</label>
          <input
            id="displayname"
            type="text"
            name="displayname"
            value={formData.displayname}
            onChange={handleInputChange}
            placeholder="display name"
            autoComplete="off"
          />
          <div className="help-text">
            Your nickname can only be changed once every 7 days.
          </div>
        </div>

        <hr className="divider" />

        <div className="form-group">
          <label className="field-label" htmlFor="pronouns">Pronouns</label>
          <input
            id="pronouns"
            type="text"
            name="pronouns"
            value={formData.pronouns}
            onChange={handleInputChange}
            placeholder="e.g., he/him, she/her"
            autoComplete="off"
          />
        </div>

        <hr className="divider" />

        <div className="form-group">
          <label className="field-label" htmlFor="city">City</label>
          <input
            id="city"
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            placeholder="Enter city"
            autoComplete="off"
          />
        </div>

        <hr className="divider" />

        <div className="form-group">
          <label className="field-label" htmlFor="province">Province</label>
          <input
            id="province"
            type="text"
            name="province"
            value={formData.province}
            onChange={handleInputChange}
            placeholder="Enter province"
            autoComplete="off"
          />
        </div>

        <div className="button-group">
          <button className="cancel-btn" onClick={onClose} disabled={isUploading}>Cancel</button>
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={isUploading || !hasChanges}
          >
            {isUploading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileOverlay;