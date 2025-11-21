import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import { db, auth } from '../firebase'; // Added auth
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, deleteDoc } from 'firebase/firestore'; // Added addDoc, deleteDoc
import supabase from '../supabase';
import VideoOverlay from './VideoOverlay';
import '../styles/profile-page.css';

const timeAgo = (date) => {
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  return `${diffInDays} days ago`;
};

const ViewProfilePage = () => {
  const { uploaderId } = useParams(); // Fixed: Destructure 'uploaderId' to match the route parameter
  const navigate = useNavigate(); // Added for redirection
  const [dbUser, setDbUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('Videos');
  const [currentUser, setCurrentUser] = useState(null); // Added for current user
  const [isFollowing, setIsFollowing] = useState(false); // Added for follow status
  const [isFollowedBy, setIsFollowedBy] = useState(false); // Added for follow-back status
  const [followingCount, setFollowingCount] = useState(0); // Added for dynamic following count
  const [followersCount, setFollowersCount] = useState(0); // Added for dynamic followers count
  const [totalLikes, setTotalLikes] = useState(0); // Added for dynamic total likes

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Redirect if viewing own profile
  useEffect(() => {
    if (currentUser && uploaderId === currentUser.uid) {
      navigate('/profile');
    }
  }, [uploaderId, currentUser, navigate]);

  // Fetch User Document
  useEffect(() => {
    if (!uploaderId) return; // Fixed: Use uploaderId
    const fetchUser = async () => {
      try {
        const userDocRef = doc(db, 'users', uploaderId); // Fixed: Use uploaderId
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) setDbUser(userDocSnap.data());
        else setDbUser(null);
      } catch (error) {
        console.error('Error fetching user:', error);
        setDbUser(null);
      }
    };
    fetchUser();
  }, [uploaderId]); // Fixed: Depend on uploaderId

  // Fetch follow status
  useEffect(() => {
    if (!currentUser || !uploaderId) return;
    const fetchFollowStatus = async () => {
      try {
        // Check if current user is following uploaderId
        const followingQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', currentUser.uid),
          where('followedId', '==', uploaderId)
        );
        const followingSnapshot = await getDocs(followingQuery);
        setIsFollowing(!followingSnapshot.empty);

        // Check if uploaderId is following current user
        const followedByQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', uploaderId),
          where('followedId', '==', currentUser.uid)
        );
        const followedBySnapshot = await getDocs(followedByQuery);
        setIsFollowedBy(!followedBySnapshot.empty);
      } catch (error) {
        console.error('Error fetching follow status:', error);
      }
    };
    fetchFollowStatus();
  }, [currentUser, uploaderId]);

  // Fetch following count
  useEffect(() => {
    if (!uploaderId) return;
    const fetchFollowingCount = async () => {
      try {
        const followingQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', uploaderId)
        );
        const followingSnapshot = await getDocs(followingQuery);
        setFollowingCount(followingSnapshot.size);
      } catch (error) {
        console.error('Error fetching following count:', error);
      }
    };
    fetchFollowingCount();
  }, [uploaderId]);

  // Fetch followers count
  useEffect(() => {
    if (!uploaderId) return;
    const fetchFollowersCount = async () => {
      try {
        const followersQuery = query(
          collection(db, 'connections'),
          where('followedId', '==', uploaderId)
        );
        const followersSnapshot = await getDocs(followersQuery);
        setFollowersCount(followersSnapshot.size);
      } catch (error) {
        console.error('Error fetching followers count:', error);
      }
    };
    fetchFollowersCount();
  }, [uploaderId]);

  // Fetch videos uploaded by user and calculate total likes from interactions
  useEffect(() => {
    if (!uploaderId) return; // Fixed: Use uploaderId
    const fetchUserVideos = async () => {
      try {
        const videosQuery = query(
          collection(db, 'videos'),
          where('uploaderId', '==', uploaderId), // Fixed: Use uploaderId
          orderBy('uploadedAt', 'desc')
        );
        const videosSnapshot = await getDocs(videosQuery);
        const videosList = [];

        for (const doc of videosSnapshot.docs) {
          const videoData = doc.data();
          const { caption, fileName, uploadedAt, views = 0, locked = false } = videoData; // Removed likes from destructuring
          const videoId = doc.id; // Get the doc ID as videoId

          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);

          videosList.push({
            videoId, // Changed: Use videoId instead of id to match VideoOverlay
            videoSrc: publicUrl,
            caption: caption || 'Untitled Video',
            timeUploaded: uploadedAt ? timeAgo(uploadedAt.toDate()) : '',
            views,
            locked,
            uploaderName: dbUser?.displayname || 'Unknown', // Added for VideoOverlay
            uploaderUsername: dbUser?.username || '@unknown', // Added for VideoOverlay
            uploaderProfilePic: dbUser?.photoURL || null, // Added for VideoOverlay
          });
        }
        setVideos(videosList);

        // Fetch total likes from interactions for these videos
        if (videosList.length > 0) {
          const videoIds = videosList.map(v => v.videoId);
          const likesQuery = query(
            collection(db, 'interactions'),
            where('type', '==', 'like'),
            where('videoId', 'in', videoIds)
          );
          const likesSnapshot = await getDocs(likesQuery);
          setTotalLikes(likesSnapshot.size);
        } else {
          setTotalLikes(0);
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoadingVideos(false);
      }
    };
    fetchUserVideos();
  }, [uploaderId, dbUser]); // Added dbUser dependency for uploader info

  const handleVideoClick = (video) => setSelectedVideo(video);
  const closeOverlay = () => setSelectedVideo(null);

  // Handle follow/unfollow action
  const handleFollowToggle = async () => {
    if (!currentUser) {
      alert('You must be logged in to follow users.');
      return;
    }
    try {
      if (isFollowing) {
        // Unfollow: Delete the connection document
        const followingQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', currentUser.uid),
          where('followedId', '==', uploaderId)
        );
        const followingSnapshot = await getDocs(followingQuery);
        followingSnapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1); // Update count immediately
      } else {
        // Follow: Add the connection document
        await addDoc(collection(db, 'connections'), {
          followerId: currentUser.uid,
          followedId: uploaderId,
          timestamp: new Date(),
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1); // Update count immediately
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert('Failed to update follow status. Please try again.');
    }
  };

  // Determine button label
  const getButtonLabel = () => {
    if (isFollowing && isFollowedBy) return 'Friends';
    if (isFollowing) return 'Followed';
    if (isFollowedBy) return 'Follow Back';
    return 'Follow';
  };

  if (!dbUser) {
    return <div className="profile-page-container">User not found.</div>;
  }

  const displayname = dbUser.displayname || 'Anonymous User';
  const usernameTag = dbUser.username || 'anonymous';
  const bio = dbUser.bio || '';

  return (
    <div className="profile-page-container" style={{ backgroundColor: 'black', color: 'white' }}>
      <div className="profile-header-container">
        <div className="profile-avatar-large">
          {dbUser.photoURL ? (
            <img alt="Profile" src={dbUser.photoURL} />
          ) : (
            <div className="avatar-placeholder-large">{displayname.charAt(0).toUpperCase()}</div>
          )}
        </div>

        <div className="user-info">
          <div className="username-line">
            <h2 className="username">{usernameTag}</h2>
            <span className="display-name">{displayname}</span>
          </div>

          <div className="profile-buttons">
            <button className="btn-follow" onClick={handleFollowToggle}>{getButtonLabel()}</button> {/* Updated onClick and text */}
            <button className="btn-message">Message</button>
            <button className="btn-add-user" aria-label="Add User">➕</button>
            <button className="btn-share" aria-label="Share">↗️</button>
            <button className="btn-more" aria-label="More Options">...</button>
          </div>

          <div className="profile-stats">
            <span><strong>{followingCount}</strong> Following</span>
            <span><strong>{followersCount}</strong> Followers</span>
            <span><strong>{totalLikes}</strong> Likes</span>
          </div>

          <div className="profile-bio">{bio}</div>
        </div>
      </div>

      <nav className="profile-tabs">
        {['Videos', 'Reposts', 'Liked'].map(tab => (
          <button
            key={tab}
            className={`tab-item${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab}
          >
            {tab} {/* Add icons if needed */}
          </button>
        ))}
      </nav>

      {activeTab === 'Videos' && (
        <section className="videos-grid">
          {loadingVideos ? (
            <p>Loading videos...</p>
          ) : videos.length === 0 ? (
            <p>No videos uploaded yet.</p>
          ) : (
            videos.map(video => (
              <div
                key={video.videoId} // Changed: Use videoId as key
                className="video-card"
                title={video.caption}
                onClick={() => handleVideoClick(video)}
              >
                <div
                  className="video-thumbnail"
                  style={{ backgroundImage: `url(${video.videoSrc})` }}
                >
                  <div className="video-views">▶ {video.views}</div>
                  {video.locked && <div className="video-lock">🔒</div>}
                </div>

                <div className="video-caption">{video.caption}</div>
              </div>
            ))
          )}
        </section>
      )}

      {selectedVideo && <VideoOverlay video={selectedVideo} onClose={closeOverlay} />}
    </div>
  );
};

export default ViewProfilePage;
