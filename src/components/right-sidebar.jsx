import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';  // Import useNavigate
import { auth, db } from '../firebase'; // Added db
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'; // Added Firestore imports
import supabase from '../supabase'; // Added supabase import for fetching profile picture
import ChatOverlay from './ChatOverlay'; // Import the new ChatOverlay component
import '../styles/right-sidebar.css';

const RightSidebar = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null); // Added state for Firestore user data
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState([]); // State for following list (now only mutuals)
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState(null); // State for selected user to chat with

  const navigate = useNavigate(); // initialize navigate

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user document from Firestore to get profile picture URL
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

  // Fetch only mutual follows: users the logged-in user follows AND who follow them back
  const fetchFollowing = async (userId) => {
    setLoadingFollowing(true);
    try {
      // First, get all users who follow the logged-in user (potential mutuals)
      const followersQuery = query(
        collection(db, 'connections'),
        where('followedId', '==', userId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      const mutualList = [];

      for (const followerDoc of followersSnapshot.docs) {
        const { followerId } = followerDoc.data();
        
        // Check if the logged-in user follows this follower back (confirm mutual)
        const mutualQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', userId),
          where('followedId', '==', followerId)
        );
        const mutualSnapshot = await getDocs(mutualQuery);
        
        if (!mutualSnapshot.empty) {
          // It's mutual, so fetch user details
          const userDoc = await getDoc(doc(db, 'users', followerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            mutualList.push({
              id: followerId,
              displayName: userData.displayname || 'Unknown',
              username: userData.username || 'unknown',
              photoURL: userData.photoURL || null,
              isMutual: true,  // Always true here
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

  // Handler for clicking profile picture
  const handleProfileClick = () => {
    navigate('/profile'); // Redirect to profile page
  };

  // Handler for clicking a mutual user (opens chat)
  const handleUserClick = (followedUser) => {
    setSelectedChatUser(followedUser); // Open chat overlay (since all are mutual)
  };

  // Handler to close chat overlay
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
            <div
              className="profile-avatar"
              onClick={handleProfileClick}
              style={{ cursor: 'pointer' }}  // Cursor pointer for clickable effect
              title="Go to Profile"
            >
              {dbUser?.photoURL ? (  // Updated: Use dbUser.photoURL (from Supabase via Firestore)
                <img
                  src={dbUser.photoURL}
                  alt="Profile"
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="profile-info">
              <h4 className="display-name">
                {dbUser?.displayname || user.displayName || 'Anonymous User'}  {/* Updated: Prefer dbUser.displayname */}
              </h4>
              <p className="username">
                @{dbUser?.username || (user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : 'anonymous')}  {/* Updated: Prefer dbUser.username */}
              </p>
              <p className="email">
                {user.email || 'No email provided'}
              </p>
            </div>
            {user.isAnonymous && (
              <div className="anonymous-badge">
                Guest Account
              </div>
            )}
            {/* Mutual Following Section */}
            <div className="following-section">
              <h4>Friends ({following.length})</h4>  {/* Renamed for clarity */}
              {loadingFollowing ? (
                <p>Loading friends...</p>
              ) : following.length === 0 ? (
                <p>No mutual friends yet.</p>
              ) : (
                <ul className="following-list">
                  {following.slice(0, 5).map((followedUser) => ( // Limit to 5 for brevity
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
                        {/* Removed mutual badge since all are mutual */}
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
      {/* Chat Overlay */}
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
