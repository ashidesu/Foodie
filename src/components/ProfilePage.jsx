import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import supabase from '../supabase';
import VideoOverlay from './VideoOverlay';
import EditProfileOverlay from './EditProfileOverlay'; // NEW: Import the overlay component
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

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);    // Holds Firestore user doc data
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('Videos');
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [showEditOverlay, setShowEditOverlay] = useState(false); // NEW: State to control overlay visibility

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user document from Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setDbUser(userDocSnap.data());
          } else {
            setDbUser(null);
            console.warn('No user document found');
          }
        } catch (error) {
          console.error('Error loading user document:', error);
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch following count
  useEffect(() => {
    if (!user) return;
    const fetchFollowingCount = async () => {
      try {
        const followingQuery = query(
          collection(db, 'connections'),
          where('followerId', '==', user.uid)
        );
        const followingSnapshot = await getDocs(followingQuery);
        setFollowingCount(followingSnapshot.size);
      } catch (error) {
        console.error('Error fetching following count:', error);
      }
    };
    fetchFollowingCount();
  }, [user]);

  // Fetch followers count
  useEffect(() => {
    if (!user) return;
    const fetchFollowersCount = async () => {
      try {
        const followersQuery = query(
          collection(db, 'connections'),
          where('followedId', '==', user.uid)
        );
        const followersSnapshot = await getDocs(followersQuery);
        setFollowersCount(followersSnapshot.size);
      } catch (error) {
        console.error('Error fetching followers count:', error);
      }
    };
    fetchFollowersCount();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchUserVideos = async () => {
      try {
        const videosQuery = query(
          collection(db, 'videos'),
          where('uploaderId', '==', user.uid),
          orderBy('uploadedAt', 'desc')
        );
        const videosSnapshot = await getDocs(videosQuery);

        const videosList = [];

        for (const doc of videosSnapshot.docs) {
          const videoData = doc.data();
          const { uploaderId, caption, fileName, uploadedAt, views = 0, locked = false } = videoData;
          const videoId = doc.id; // Get the doc ID as videoId

          // Fetch uploader info from users collection (can optimize if you want)
          const usersSnapshot = await getDocs(collection(db, 'users'));
          const uploaderDoc = usersSnapshot.docs.find(d => d.id === uploaderId);
          const uploader = uploaderDoc ? uploaderDoc.data() : { displayname: 'Unknown', username: '@unknown', photoURL: null };

          // Get video URL from Supabase
          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);

          videosList.push({
            videoId, // Changed: Use videoId instead of id to match VideoOverlay
            videoSrc: publicUrl,
            caption: caption || 'Untitled Video',
            uploaderName: uploader.displayname || 'Unknown',
            uploaderUsername: uploader.username || '@unknown',
            uploaderProfilePic: uploader.photoURL || null,
            timeUploaded: uploadedAt ? timeAgo(uploadedAt.toDate()) : '',
            views,
            locked
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
        console.error('Error fetching user videos:', error);
      } finally {
        setLoadingVideos(false);
      }
    };

    fetchUserVideos();
  }, [user]);

  // NEW: Callback to update dbUser after editing (avoids full refetch)
  const handleProfileUpdate = (updatedData) => {
    setDbUser((prev) => ({ ...prev, ...updatedData }));
  };

  if (!user) {
    return <div className="profile-page-container">Please log in to see your profile.</div>;
  }

  // Use dbUser info if available, else fallback to auth user displayname/email/uid
  const displayname = dbUser?.displayname || user.displayname || 'Anonymous User';
  const usernameTag = dbUser?.username || (user.displayname ? user.displayname.toLowerCase().replace(/\s+/g, '') : 'anonymous');

  // Open overlay on video click
  const handleVideoClick = (video) => setSelectedVideo(video);
  // Close video overlay
  const closeOverlay = () => setSelectedVideo(null);

  return (
    <div className="profile-page-container">
      <div className="profile-header-container">
        <div className="profile-avatar-large">
          {(dbUser?.photoURL || user.photoURL) ? (
            <img alt="Profile" src={dbUser?.photoURL || user.photoURL} />
          ) : (
            <div className="avatar-placeholder-large">
              {displayname.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="user-info">
          <div className="username-line">
            <h2 className="username">{usernameTag}</h2>
            <span className="display-name">{displayname}</span>
          </div>

          <div className="profile-buttons">
            <button className="btn-edit-profile" onClick={() => setShowEditOverlay(true)}>Edit profile</button> {/* MODIFIED: Opens the edit overlay */}
            <button className="btn-promote-post">Promote post</button>
            <button className="btn-settings" aria-label="Settings">⚙️</button>
            <button className="btn-share" aria-label="Share">↗️</button>
          </div>

          <div className="profile-stats">
            <span><strong>{followingCount}</strong> Following</span>
            <span><strong>{followersCount}</strong> Followers</span>
            <span><strong>{totalLikes}</strong> Likes</span>
          </div>

          <div className="profile-bio">{dbUser?.bio || ''}</div>
        </div>
      </div>

      <nav className="profile-tabs">
        {['Videos', 'Reposts', 'Favorites', 'Liked'].map(tab => (
          <button
            key={tab}
            className={`tab-item${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab}
          >
            {tab === 'Videos' && '📹 '}
            {tab === 'Reposts' && '🔄 '}
            {tab === 'Favorites' && '⭐ '}
            {tab === 'Liked' && '❤️ '}
            {tab}
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

      {/* Video Overlay */}
      {selectedVideo && <VideoOverlay video={selectedVideo} onClose={closeOverlay} />}

      {/* NEW: Edit Profile Overlay */}
      {showEditOverlay && (
        <EditProfileOverlay
          user={user}
          dbUser={dbUser}
          onClose={() => setShowEditOverlay(false)}
          onUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
};

export default ProfilePage;