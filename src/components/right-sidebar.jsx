import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import ChatOverlay from './ChatOverlay';
import SettingsOverlay from './settingsOverlay';
import '../styles/right-sidebar.css';

const RightSidebar = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false); // State for settings overlay

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setDbUser(userDocSnap.data());
          } else {
            setDbUser(null);
          }
        } catch (error) {
          console.error('Error loading user document:', error);
          setDbUser(null);
        }
        fetchFollowing(currentUser.uid);
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchFollowing = async (userId) => {
    setLoadingFollowing(true);
    try {
      const followersQuery = query(
        collection(db, 'connections'),
        where('followedId', '==', userId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      const mutualList = [];

      for (const followerDoc of followersSnapshot.docs) {
        const { followerId } = followerDoc.data();

        const mutualQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', userId),
          where('followedId', '==', followerId)
        );
        const mutualSnapshot = await getDocs(mutualQuery);

        if (!mutualSnapshot.empty) {
          const userDoc = await getDoc(doc(db, 'users', followerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            mutualList.push({
              id: followerId,
              displayName: userData.displayname || 'Unknown',
              username: userData.username || 'unknown',
              photoURL: userData.photoURL || null,
              isMutual: true,
            });
          }
        }
      }
      setFollowing(mutualList);
    } catch (error) {
      console.error('Error fetching mutual follows:', error);
    } finally {
      setLoadingFollowing(false);
    }
  };

  if (loading) {
    return (
      <div className="right-sidebar">
        <div className="profile-card">
          <div className="profile-loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="right-sidebar">
        <div className="profile-card">
          <div className="profile-not-logged-in">
            <p>Not logged in</p>
          </div>
        </div>
      </div>
    );
  }

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleUserClick = (followedUser) => {
    setSelectedChatUser(followedUser);
  };

  const closeChat = () => {
    setSelectedChatUser(null);
  };

  return (
    <>
      <div className="right-sidebar">
        <div className="profile-card">
          <div className="profile-header">
            <h3>Your Profile</h3>
            {/* Gear icon button at top-right */}
            <button
              className="settings-icon"
              onClick={() => setShowSettings(true)}
              aria-label="Open settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="profile-content">
            {/* Flex container with avatar on left and info on right */}
            <div className="profile-top-row">
              <div
                className="profile-avatar"
                onClick={handleProfileClick}
                style={{ cursor: 'pointer' }}
                title="Go to Profile"
              >
                {dbUser?.photoURL ? (
                  <img
                    src={dbUser.photoURL}
                    alt="Profile"
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {dbUser?.displayname
                      ? dbUser.displayname.charAt(0).toUpperCase()
                      : user.displayName
                        ? user.displayName.charAt(0).toUpperCase()
                        : user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="profile-info-text">
                <h4 className="display-name" title={dbUser?.displayname || user.displayName || 'Anonymous User'}>
                  {dbUser?.displayname || user.displayName || 'Anonymous User'}
                </h4>
                <p className="username">
                  @{dbUser?.username || (user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : 'anonymous')}
                </p>
              </div>
            </div>

            {user.isAnonymous && (
              <div className="anonymous-badge">
                Guest Account
              </div>
            )}

            {/* Connections below */}
            <div className="following-section">
              <h4>Connections ({following.length})</h4>
              {loadingFollowing ? (
                <p>Loading connections...</p>
              ) : following.length === 0 ? (
                <p>No mutual connections yet.</p>
              ) : (
                <ul className="following-list">
                  {following.slice(0, 5).map((followedUser) => (
                    <li
                      key={followedUser.id}
                      className="following-item"
                      onClick={() => handleUserClick(followedUser)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="followed-avatar">
                        {followedUser.photoURL ? (
                          <img src={followedUser.photoURL} alt={followedUser.displayName} />
                        ) : (
                          <div className="avatar-placeholder-small">
                            {followedUser.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="followed-info">
                        <span className="followed-name">{followedUser.displayName}</span>
                        <span className="followed-username">@{followedUser.username}</span>
                      </div>
                    </li>
                  ))}
                  {following.length > 5 && (
                    <li className="see-more" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
                      See more...
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedChatUser && (
        <ChatOverlay
          currentUser={user}
          chatUser={selectedChatUser}
          onClose={closeChat}
        />
      )}

      {/* Settings Overlay */}
      <SettingsOverlay
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};

export default RightSidebar;