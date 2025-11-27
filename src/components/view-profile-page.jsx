import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import { db, auth } from '../firebase'; // Added auth
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, deleteDoc } from 'firebase/firestore'; // Added addDoc, deleteDoc
import supabase from '../supabase';
import VideoOverlay from './VideoOverlay';
import FollowersFollowingOverlay from './FollowersFollowingOverlay'; // Add this import
import ChatOverlay from './ChatOverlay'; // Add this import
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
  const [showFollowingOverlay, setShowFollowingOverlay] = useState(false); // Add this state
  const [selectedChatUser, setSelectedChatUser] = useState(null); // Add this state

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

  // Fetch videos based on active tab
  useEffect(() => {
    if (!uploaderId) return;

    const fetchUploadedVideos = async () => {
      setLoadingVideos(true);
      try {
        const videosQuery = query(
          collection(db, 'videos'),
          where('uploaderId', '==', uploaderId),
          orderBy('uploadedAt', 'desc')
        );
        const videosSnapshot = await getDocs(videosQuery);
        const videosList = [];

        for (const doc of videosSnapshot.docs) {
          const videoData = doc.data();
          const { caption, fileName, uploadedAt, views = 0, locked = false } = videoData;
          const videoId = doc.id;

          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);

          videosList.push({
            videoId,
            videoSrc: publicUrl,
            caption: caption || 'Untitled Video',
            timeUploaded: uploadedAt ? timeAgo(uploadedAt.toDate()) : '',
            views,
            locked,
            uploaderName: dbUser?.displayname || 'Unknown',
            uploaderUsername: dbUser?.username || '@unknown',
            uploaderProfilePic: dbUser?.photoURL || null,
          });
        }
        setVideos(videosList);
      } catch (error) {
        console.error('Error fetching videos:', error);
        setVideos([]);
      } finally {
        setLoadingVideos(false);
      }
    };

    const fetchLikedVideos = async () => {
      setLoadingVideos(true);
      try {
        // Fetch interactions of type 'like' by uploaderId
        const likesQuery = query(
          collection(db, 'interactions'),
          where('userId', '==', uploaderId),
          where('type', '==', 'like')
        );
        const likesSnapshot = await getDocs(likesQuery);
        const likedVideoIds = likesSnapshot.docs.map(doc => doc.data().videoId);

        if (likedVideoIds.length === 0) {
          setVideos([]);
          setLoadingVideos(false);
          return;
        }

        // Firestore 'in' queries are limited to 10, so chunk accordingly
        const chunkSize = 10;
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const likedVideosList = [];

        for (let i = 0; i < likedVideoIds.length; i += chunkSize) {
          const chunk = likedVideoIds.slice(i, i + chunkSize);

          const videosQuery = query(
            collection(db, 'videos'),
            where('__name__', 'in', chunk)
          );
          const videosSnapshot = await getDocs(videosQuery);

          for (const docSnap of videosSnapshot.docs) {
            const videoData = docSnap.data();
            const {
              uploaderId: vidUploaderId,
              caption,
              fileName,
              uploadedAt,
              views = 0,
              locked = false,
            } = videoData;
            const videoId = docSnap.id;

            const uploaderDoc = usersSnapshot.docs.find((d) => d.id === vidUploaderId);
            const uploader = uploaderDoc
              ? uploaderDoc.data()
              : { displayname: 'Unknown', username: '@unknown', photoURL: null };

            const {
              data: { publicUrl },
            } = supabase.storage.from('videos').getPublicUrl(fileName);

            likedVideosList.push({
              videoId,
              videoSrc: publicUrl,
              caption: caption || 'Untitled Video',
              uploaderName: uploader.displayname || 'Unknown',
              uploaderUsername: uploader.username || '@unknown',
              uploaderProfilePic: uploader.photoURL || null,
              timeUploaded: uploadedAt ? timeAgo(uploadedAt.toDate()) : '',
              views,
              locked,
            });
          }
        }

        setVideos(likedVideosList);
      } catch (error) {
        console.error('Error fetching liked videos:', error);
        setVideos([]);
      } finally {
        setLoadingVideos(false);
      }
    };

    if (activeTab === 'Videos') {
      fetchUploadedVideos();
    } else if (activeTab === 'Liked') {
      fetchLikedVideos();
    }
  }, [uploaderId, activeTab, dbUser]);

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

  // Determine button label and color
  const getButtonLabel = () => {
    if (isFollowing && isFollowedBy) return 'Friends';
    if (isFollowing) return 'Followed';
    if (isFollowedBy) return 'Follow Back';
    return 'Follow';
  };

  const getFollowButtonStyle = () => {
    if (isFollowing && isFollowedBy) {
      return { backgroundColor: '#666' }; // Gray for friends
    } else if (isFollowing || isFollowedBy) {
      return { backgroundColor: '#fe2c55' }; // Pink for follow or follow back
    }
    return { backgroundColor: '#ff004f' }; // Default pink
  };

  if (!dbUser) {
    return <div className="profile-page-container">User not found.</div>;
  }

  const displayname = dbUser.displayname || 'Anonymous User';
  const usernameTag = dbUser.username || 'anonymous';
  const bio = dbUser.bio || '';
  const isMutual = isFollowing && isFollowedBy;

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
            <button className="btn-follow" onClick={handleFollowToggle} style={getFollowButtonStyle()}>{getButtonLabel()}</button>
            {isMutual && (
              <button className="btn-message" onClick={() => setSelectedChatUser({ id: uploaderId, displayName: displayname, username: usernameTag, photoURL: dbUser.photoURL })}>Message</button>
            )}
          </div>

          <div className="profile-stats">
            <span
              onClick={() => setShowFollowingOverlay(true)}
              style={{ cursor: 'pointer' }}
            >
              <strong>{followingCount}</strong> Following
            </span>
            <span><strong>{followersCount}</strong> Followers</span>
            <span><strong>{totalLikes}</strong> Likes</span>
          </div>

          <div className="profile-bio">{bio}</div>
        </div>
      </div>

      <nav className="profile-tabs">
        {['Videos', 'Liked'].map(tab => (
          <button
            key={tab}
            className={`tab-item${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab}
          >
            {tab}
          </button>
        ))}
      </nav>

      {loadingVideos ? (
        <p>Loading videos...</p>
      ) : videos.length === 0 ? (
        <p>{activeTab === 'Videos' ? 'No videos uploaded yet.' : 'No liked videos found.'}</p>
      ) : (
        <section className="videos-grid">
          {videos.map(video => (
            <div
              key={video.videoId}
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
          ))}
        </section>
      )}

      {selectedVideo && <VideoOverlay video={selectedVideo} onClose={closeOverlay} />}

      {showFollowingOverlay && (
        <FollowersFollowingOverlay
          isOpen={showFollowingOverlay}
          onClose={() => setShowFollowingOverlay(false)}
          profileUserId={uploaderId}
        />
      )}

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

export default ViewProfilePage;