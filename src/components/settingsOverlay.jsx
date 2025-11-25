import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { auth } from '../firebase'; // Adjust path if needed
import '../styles/settings.css';

const SettingsOverlay = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(false);
  const [applicationActive, setApplicationActive] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null); // New state for application status
  const [loading, setLoading] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [allowBrowserNotifications, setAllowBrowserNotifications] = useState(false);
  // New states for change password
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isGoogleSignIn, setIsGoogleSignIn] = useState(false); // New state to check Google sign-in

  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsGoogleSignIn(currentUser.providerData.some(provider => provider.providerId === 'google.com'));
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setBusiness(userData.business || false);
          setApplicationActive(userData.applicationActive || false);
          setPrivateAccount(userData.privateAccount || false);
          setAllowBrowserNotifications(userData.allowBrowserNotifications || false);
          
          // Fetch application status if applicationId exists
          if (userData.applicationId) {
            const appDoc = await getDoc(doc(db, 'applications', userData.applicationId));
            if (appDoc.exists()) {
              setApplicationStatus(appDoc.data().status);
            }
          } else {
            setApplicationStatus(null);
          }
        }
      } else {
        setUser(null);
        setBusiness(false);
        setApplicationActive(false);
        setApplicationStatus(null);
        setPrivateAccount(false);
        setAllowBrowserNotifications(false);
        setIsGoogleSignIn(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  // Toggle business account state and update Firestore (kept for potential future use, but not used in render)
  const handleToggleBusiness = async () => {
    if (!user) return;
    try {
      const newBusinessState = !business;
      await updateDoc(doc(db, 'users', user.uid), {
        business: newBusinessState,
      });
      setBusiness(newBusinessState);
    } catch (error) {
      console.error('Error toggling business account:', error);
    }
  };

  // Handle change password toggle
  const handleChangePassword = () => {
    setShowChangePasswordForm(!showChangePasswordForm);
    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Handle password change submission
  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password should be at least 6 characters.');
      return;
    }
    try {
      if (isGoogleSignIn) {
        // For Google sign-in users, link email/password provider
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await user.linkWithCredential(credential);
        alert('Password set successfully! You can now log in with email and password.');
      } else {
        // For email/password users, reauthenticate and update
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        alert('Password changed successfully!');
      }
      setShowChangePasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(error.message);
    }
  };

  // Handle delete account action (example only, implement securely)
  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (confirmed) {
      try {
        // Delete user account from Firebase Auth
        await auth.currentUser.delete();

        // Also delete user document from Firestore (optional)
        await updateDoc(doc(db, 'users', user.uid), { deleted: true });

        onClose();
        navigate('/goodbye'); // Redirect or show goodbye page
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account: ' + error.message);
      }
    }
  };

  // Other existing handlers kept as they are

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login'); // Adjust redirect path as needed
      onClose();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSendApplication = async () => {
    if (user && !applicationActive) {
      try {
        const applicationData = {
          userId: user.uid,
          submittedAt: new Date(),
          status: 'pending',
        };
        const docRef = await addDoc(collection(db, 'applications'), applicationData);
        await updateDoc(doc(db, 'users', user.uid), {
          applicationActive: true,
          applicationId: docRef.id,
        });
        setApplicationActive(true);
        setApplicationStatus('pending');
        alert('Application sent successfully!');
      } catch (error) {
        console.error('Error sending application:', error);
      }
    }
  };

  const handleGoToBusinessSite = () => {
    navigate('/business');
    onClose();
  };

  const handleOptionClick = (path) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-settings" onClick={onClose} aria-label="Close settings">
          ×
        </button>

        {/* Manage account Section */}
        <h2 className="section-title">Manage account</h2>

        <div className="section">
          <h3 className="section-subtitle">Account control</h3>
          {/* Modified Business Account Section */}
          <div className="setting-item horizontal-space-between">
            <div>
              <strong>Business Account</strong>
              <p className="description small-margin">
                {business ? 'Your account is set to business. Access your business site.' : 
                 applicationStatus === 'pending' ? 'Your application is pending review.' : 
                 'Switch your account to a business account for more features.'}
              </p>
            </div>
            {business ? (
              <button className="action-button-text" onClick={handleGoToBusinessSite}>Go to site</button>
            ) : applicationStatus === 'pending' ? (
              <span className="applied-text">Applied</span>
            ) : (
              <button className="action-button-text" onClick={handleSendApplication}>Send application</button>
            )}
          </div>

          <div className="setting-item horizontal-space-between">
            <span><strong>Change password</strong></span>
            <button className="action-button-text" onClick={handleChangePassword}>Change</button>
          </div>

          {/* Change Password Form */}
          {showChangePasswordForm && (
            <div className="setting-item">
              <form onSubmit={handlePasswordChangeSubmit}>
                {!isGoogleSignIn && (
                  <div className="form-group">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="newPassword">{isGoogleSignIn ? 'Set Password' : 'New Password'}</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm {isGoogleSignIn ? 'Password' : 'New Password'}</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {passwordError && <p className="error-text">{passwordError}</p>}
                <button type="submit" className="submit-button">{isGoogleSignIn ? 'Set Password' : 'Update Password'}</button>
                <button type="button" className="cancel-button" onClick={() => setShowChangePasswordForm(false)}>Cancel</button>
              </form>
            </div>
          )}

          <div className="setting-item horizontal-space-between delete-item">
            <span><strong>Delete account</strong></span>
            <button className="red-text action-button-text" onClick={handleDeleteAccount}>Delete</button>
          </div>
        </div>

        {/* New Section for Rejected Application Status */}
        {applicationStatus === 'rejected' && (
          <div className="section">
            <h3 className="section-subtitle">Application Status</h3>
            <p className="description">Your business application has been rejected. You can apply again if eligible.</p>
            {/* Add more details if available, e.g., reason from Firestore */}
          </div>
        )}

        {/* Add other sections here if needed, e.g., Privacy, Notifications, etc. */}

        {/* Logout Button */}
        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
};

export default SettingsOverlay;
