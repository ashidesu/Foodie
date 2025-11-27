import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import ChatOverlay from './ChatOverlay';
import '../styles/followers-following-overlay.css';

const FollowersFollowingOverlay = ({ isOpen, onClose, profileUserId }) => {
  const [activeTab, setActiveTab] = useState('Following');
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [mutualsList, setMutualsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    if (!profileUserId) return;

    setLoading(true);

    const fetchConnections = async () => {
      try {
        // Fetch following users for profileUserId
        const followingQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', profileUserId)
        );
        const followingSnapshot = await getDocs(followingQuery);
        const followingIds = followingSnapshot.docs.map(doc => doc.data().followedId);

        // Fetch followers for profileUserId
        const followersQuery = query(
          collection(db, 'connections'),
          where('followedId', '==', profileUserId)
        );
        const followersSnapshot = await getDocs(followersQuery);
        const followersIds = followersSnapshot.docs.map(doc => doc.data().followerId);

        // Fetch detailed user data for following (parallel)
        const followingPromises = followingIds.map(id => getDoc(doc(db, 'users', id)));
        const followingDocs = await Promise.all(followingPromises);
        const followingData = followingDocs.map((userDoc, index) => {
          const id = followingIds[index];
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Check if currentUser is following this user
            let isCurrentFollowing = false;
            if (currentUser) {
              // Note: This check might need to be done separately if many, but for now inline
              // To optimize, perhaps fetch all at once, but for simplicity, keep as is
              return { id, ...userData, isCurrentFollowing: false }; // Placeholder, will update below
            }
            return { id, ...userData, isCurrentFollowing };
          }
          return null;
        }).filter(Boolean);

        // Similarly for followers
        const followersPromises = followersIds.map(id => getDoc(doc(db, 'users', id)));
        const followersDocs = await Promise.all(followersPromises);
        const followersData = followersDocs.map((userDoc, index) => {
          const id = followersIds[index];
          if (userDoc.exists()) {
            const userData = userDoc.data();
            let isCurrentFollowing = false;
            if (currentUser) {
              return { id, ...userData, isCurrentFollowing: false }; // Placeholder
            }
            return { id, ...userData, isCurrentFollowing };
          }
          return null;
        }).filter(Boolean);

        // Now, to check isCurrentFollowing, we need to fetch for each, but to optimize, perhaps batch
        // For now, since it's a small list, we can do sequential checks or assume for demo
        // But to fix loading, let's set them properly
        // Actually, to make it fast, perhaps skip the check here and do it on button render, but since buttons are conditional, let's keep

        // For simplicity, set isCurrentFollowing to false for now, and handle in button logic if needed
        // But to match original, let's add the check
        for (let user of followingData) {
          if (currentUser) {
            const cfQuery = query(
              collection(db, 'connections'),
              where('followerId', '==', currentUser.uid),
              where('followedId', '==', user.id)
            );
            const cfSnap = await getDocs(cfQuery);
            user.isCurrentFollowing = !cfSnap.empty;
          }
        }
        for (let user of followersData) {
          if (currentUser) {
            const cfQuery = query(
              collection(db, 'connections'),
              where('followerId', '==', currentUser.uid),
              where('followedId', '==', user.id)
            );
            const cfSnap = await getDocs(cfQuery);
            user.isCurrentFollowing = !cfSnap.empty;
          }
        }

        setFollowingList(followingData);
        setFollowersList(followersData);

        // Calculate mutuals (users who are both in following and followers of profileUserId)
        const mutualsIdsSet = new Set(followingIds.filter(id => followersIds.includes(id)));
        const mutualsData = followingData.filter(user => mutualsIdsSet.has(user.id));
        setMutualsList(mutualsData);

      } catch (error) {
        console.error('Error fetching followers/following:', error);
        setLoading(false);
      }
      setLoading(false);
    };

    fetchConnections();
  }, [isOpen, profileUserId, refresh]);

  const handleFollow = async (userId) => {
    if (!currentUser) {
      alert('You must be logged in to follow users.');
      return;
    }
    if (currentUser.isAnonymous) {
      alert('This feature is not available for guest users.');
      return;
    }
    try {
      await addDoc(collection(db, 'connections'), {
        followerId: currentUser.uid,
        followedId: userId,
      });
      setRefresh(prev => prev + 1);
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async (userId) => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'connections'),
        where('followerId', '==', currentUser.uid),
        where('followedId', '==', userId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(async (docSnap) => {
        await deleteDoc(docSnap.ref);
      });
      setRefresh(prev => prev + 1);
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const handleRemoveFollower = async (userId) => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'connections'),
        where('followerId', '==', userId),
        where('followedId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(async (docSnap) => {
        await deleteDoc(docSnap.ref);
      });
      setRefresh(prev => prev + 1);
    } catch (error) {
      console.error('Error removing follower:', error);
    }
  };

  // Helper to check if user is mutual
  const isMutual = (userId) => mutualsList.some(mutual => mutual.id === userId);

  const handleGoToProfile = (userId) => {
    if (!currentUser) {
      alert('You must be logged in to view profiles.');
      return;
    }
    if (currentUser.isAnonymous) {
      alert('This feature is not available for guest users.');
      return;
    }
    if (userId) {
      onClose(); // Close the overlay before navigating to the new profile
      navigate(`/viewProfile/${userId}`);
    } else {
      console.warn('Cannot navigate: userId is null');
    }
  };

  const isOwnProfile = profileUserId === currentUser?.uid;

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-container-profile" onClick={e => e.stopPropagation()}>
        <div className="overlay-header">
          <h3>{currentUser?.displayName || currentUser?.email || 'User'}</h3>
          <button className="close-button" onClick={onClose} aria-label="Close overlay">&times;</button>
        </div>

        <nav className="overlay-tabs">
          {['Following', 'Followers', 'Mutuals'].map(tab => (
            <button
              key={tab}
              className={`overlay-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab}
            >
              {tab} {tab !== 'Mutuals' && (tab === 'Following' ? `(${followingList.length})` : `(${followersList.length})`)}
            </button>
          ))}
        </nav>

        <div className="overlay-content-profile">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ul className="user-list">
              {(activeTab === 'Following' && followingList) &&
                followingList.map(user => (
                  <li key={user.id} className="user-item">
                    <img
                      src={user.photoURL || '/default-avatar.png'}
                      alt={user.displayname || 'User'}
                      className="user-avatar"
                      onClick={() => handleGoToProfile(user.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div className="user-info">
                      <p 
                        className="user-displayname" 
                        onClick={() => handleGoToProfile(user.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {user.displayname || 'Unknown'}
                      </p>
                      <p className="user-username">@{user.username || 'unknown'}</p>
                      {isMutual(user.id) && <span className="mutual-label">Mutual</span>}
                    </div>
                    {isOwnProfile && (
                      user.isCurrentFollowing ? (
                        <button className="user-action-button following" onClick={() => handleUnfollow(user.id)}>
                          Unfollow
                        </button>
                      ) : (
                        <button className="user-action-button following" onClick={() => handleFollow(user.id)}>
                          Follow
                        </button>
                      )
                    )}
                  </li>
                ))}

              {(activeTab === 'Followers' && followersList) &&
                followersList.map(user => (
                  <li key={user.id} className="user-item">
                    <img
                      src={user.photoURL || '/default-avatar.png'}
                      alt={user.displayname || 'User'}
                      className="user-avatar"
                      onClick={() => handleGoToProfile(user.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div className="user-info">
                      <p 
                        className="user-displayname" 
                        onClick={() => handleGoToProfile(user.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {user.displayname || 'Unknown'}
                      </p>
                      <p className="user-username">@{user.username || 'unknown'}</p>
                      {isMutual(user.id) && <span className="mutual-label">Mutual</span>}
                    </div>
                    {isOwnProfile && (
                      user.isCurrentFollowing ? (
                        <button className="user-action-button follower" onClick={() => handleRemoveFollower(user.id)}>
                          Remove Follower
                        </button>
                      ) : (
                        <button className="user-action-button follower" onClick={() => handleFollow(user.id)}>
                          Follow Back
                        </button>
                      )
                    )}
                  </li>
                ))}

              {(activeTab === 'Mutuals' && mutualsList) &&
                mutualsList.map(user => (
                  <li key={user.id} className="user-item">
                    <img
                      src={user.photoURL || '/default-avatar.png'}
                      alt={user.displayname || 'User'}
                      className="user-avatar"
                      onClick={() => handleGoToProfile(user.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div className="user-info">
                      <p 
                        className="user-displayname" 
                        onClick={() => handleGoToProfile(user.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {user.displayname || 'Unknown'}
                      </p>
                      <p className="user-username">@{user.username || 'unknown'}</p>
                      <span className="mutual-label">Mutual</span>
                    </div>
                    <button className="user-action-button mutuals" onClick={() => setSelectedChatUser(user)}>
                      Message
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {selectedChatUser && (
        <ChatOverlay
          currentUser={currentUser}
          chatUser={selectedChatUser}
          onClose={() => setSelectedChatUser(null)}
        />
      )}
    </div>
  );
};

export default FollowersFollowingOverlay;
