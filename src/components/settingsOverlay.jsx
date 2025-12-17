// SettingsOverlay.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth } from '../firebase'; // Adjust path if needed
import BusinessApplicationOverlay from './BusinessApplicationOverlay'; // Import the new overlay
import '../styles/settings.css'; // Existing styles
import '../styles/business-application.css'; // Styles for new overlay

const SettingsOverlay = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(false);
  const [applicationActive, setApplicationActive] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [hasPasswordProvider, setHasPasswordProvider] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verificationActive, setVerificationActive] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [showBusinessApplication, setShowBusinessApplication] = useState(false);

  const db = getFirestore();

  // Helper function to fetch the most recent rejected application and set state accordingly
  const fetchMostRecentRejectedApplication = async (userId) => {
    try {
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef,
        where('uploaderId', '==', userId),
        where('status', '==', 'rejected'),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        setApplicationStatus(data.status);
        setRejectionReason(data.rejectionReason || null);
      } else {
        setApplicationStatus(null);
        setRejectionReason(null);
      }
    } catch (error) {
      console.error('Error fetching rejected application:', error);
      setApplicationStatus(null);
      setRejectionReason(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setHasPasswordProvider(currentUser.providerData.some(p => p.providerId === 'password'));
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setBusiness(userData.roles?.business || false);
          setApplicationActive(userData.applicationActive || false);
          setVerified(userData.verified || false);
          setVerificationActive(userData.verificationActive || false);

          if (userData.applicationId) {
            const appDoc = await getDoc(doc(db, 'applications', userData.applicationId));
            if (appDoc.exists()) {
              const appData = appDoc.data();
              setApplicationStatus(appData.status);
              if (appData.status === 'rejected') {
                setRejectionReason(appData.rejectionReason || null);
              } else {
                setRejectionReason(null);
              }
            } else {
              setApplicationStatus(null);
              setRejectionReason(null);
            }
          } else {
            setApplicationStatus(null);
            setRejectionReason(null);
          }
          if (userData.verificationId) {
            const verDoc = await getDoc(doc(db, 'verifications', userData.verificationId));
            setVerificationStatus(verDoc.exists() ? verDoc.data().status : null);
          } else {
            setVerificationStatus(null);
          }

          // Additionally, fetch the most recent rejected application for this user
          await fetchMostRecentRejectedApplication(currentUser.uid);

        } else {
          setBusiness(false);
          setApplicationActive(false);
          setApplicationStatus(null);
          setRejectionReason(null);
          setVerified(false);
          setVerificationActive(false);
          setVerificationStatus(null);
          setHasPasswordProvider(false);
        }
      } else {
        setUser(null);
        setBusiness(false);
        setApplicationActive(false);
        setApplicationStatus(null);
        setRejectionReason(null);
        setVerified(false);
        setVerificationActive(false);
        setVerificationStatus(null);
        setHasPasswordProvider(false);
      }
    });
    return () => unsubscribe();
  }, [db]);

  const handleChangePasswordToggle = () => {
    setShowChangePasswordForm(v => !v);
    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handlePasswordChangeSubmit = async e => {
    e.preventDefault();
    if (!user) {
      setPasswordError('You must be logged in.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password should be at least 6 characters.');
      return;
    }
    try {
      if (!hasPasswordProvider) {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await linkWithCredential(user, credential);
        setHasPasswordProvider(true);
        alert('Password set successfully! You can now log in with email and password.');
      } else {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        alert('Password changed successfully!');
      }
      setShowChangePasswordForm(false);
      setPasswordError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        await auth.currentUser.delete();
        await updateDoc(doc(db, 'users', user.uid), { deleted: true });
        onClose();
        navigate('/goodbye');
      } catch (err) {
        alert('Error deleting account: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleSendApplication = () => {
    setShowBusinessApplication(true);
  };

  const handleSendVerification = async () => {
    if (user && !verificationActive) {
      try {
        const verificationData = {
          userId: user.uid,
          submittedAt: new Date(),
          status: 'pending',
        };
        const docRef = await addDoc(collection(db, 'verifications'), verificationData);
        await updateDoc(doc(db, 'users', user.uid), {
          verificationActive: true,
          verificationId: docRef.id,
        });
        setVerificationActive(true);
        setVerificationStatus('pending');
        alert('Verification request sent successfully!');
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleGoToBusinessSite = () => {
    window.location.href = 'https://foodie-business.vercel.app/';
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-padding">
          <div
            className="settings-content"
            onClick={e => e.stopPropagation()}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="settings-header">
              <h2 className="section-title" id="settings-title">Settings</h2>
              <button className="close-settings" onClick={onClose} aria-label="Close settings">×</button>
            </div>
            <div className="settings-list">
              <h3 className="section-subtitle">Account control</h3>

              <div className="setting-item horizontal-space-between">
                <div className="setting-label">
                  <strong>Business Account</strong>
                  <p className="description small-margin">
                    {business
                      ? 'Your account is set to business. Access your business site.'
                      : applicationActive
                        ? 'Your application is under review.'
                        : 'Switch your account to a business account for more features.'}
                  </p>
                  {applicationStatus === 'rejected' && rejectionReason && (
                    <p className="rejection-text" style={{ color: '#dc3545', marginTop: '5px' }}>
                      Rejected: {rejectionReason.reason}
                      {rejectionReason.otherText ? ` - ${rejectionReason.otherText}` : ''}
                    </p>
                  )}
                </div>
                {business
                  ? <button className="action-button-text" onClick={handleGoToBusinessSite}>Go to site</button>
                  : applicationActive
                    ? <span className="applied-text">Applied</span>
                    : <button className="action-button-text" onClick={handleSendApplication}>apply</button>}
              </div>

              <div className="setting-item horizontal-space-between">
                <div className="setting-label">
                  <strong>Verify Account</strong>
                  <p className="description small-margin">
                    {verified
                      ? 'Your account is verified.'
                      : verificationActive
                        ? 'Your verification request is under review.'
                        : 'Verify your account for enhanced features and trust.'}
                  </p>
                </div>
                {verified
                  ? <span className="verified-text">Verified</span>
                  : verificationActive
                    ? <span className="applied-text">Applied</span>
                    : <button className="action-button-text" onClick={handleSendVerification}>Verify</button>}
              </div>

              <div className="setting-item horizontal-space-between change-password-item">
                <span><strong>Change password</strong></span>
                <button className="action-button-text" onClick={handleChangePasswordToggle}>Change</button>
              </div>

              {showChangePasswordForm && (
                <div className="setting-item form-group">
                  <form onSubmit={handlePasswordChangeSubmit}>
                    {hasPasswordProvider && (
                      <div className="form-group">
                        <label htmlFor="currentPassword">Current Password</label>
                        <input
                          type="password"
                          id="currentPassword"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label htmlFor="newPassword">{hasPasswordProvider ? 'New Password' : 'Set Password'}</label>
                      <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="confirmPassword">Confirm {hasPasswordProvider ? 'New Password' : 'Password'}</label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    {passwordError && <p className="error-text">{passwordError}</p>}
                    <button type="submit" className="submit-button">{hasPasswordProvider ? 'Update Password' : 'Set Password'}</button>
                    <button type="button" className="cancel-button" onClick={handleChangePasswordToggle}>Cancel</button>
                  </form>
                </div>
              )}

              <h3 className="section-subtitle">More</h3>

              <div
                className="setting-item"
                onClick={() => navigate('/about')}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/about'); }}
                style={{ cursor: 'pointer' }}
              >
                <strong>About</strong>
              </div>

              <div
                className="setting-item"
                onClick={() => navigate('/privacy-policy')}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/privacy-policy'); }}
                style={{ cursor: 'pointer' }}
              >
                <strong>Privacy Policy</strong>
              </div>

              <div
                className="setting-item"
                onClick={() => navigate('/terms-of-agreement')}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/terms-of-agreement'); }}
                style={{ cursor: 'pointer' }}
              >
                <strong>Terms of Agreement</strong>
              </div>

              <div className="setting-item horizontal-space-between delete-item">
                <span><strong>Delete account</strong></span>
                <button className="red-text action-button-text" onClick={handleDeleteAccount}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Application Overlay */}
      {showBusinessApplication && (
        <BusinessApplicationOverlay
          isOpen={showBusinessApplication}
          onClose={() => setShowBusinessApplication(false)}
        />
      )}
    </>
  );
};

export default SettingsOverlay;
