import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import ChatOverlay from './ChatOverlay';
import '../styles/right-sidebar.css';

const RightSidebar = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState(null);

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
    </>
  );
};

export default RightSidebar;