import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import supabase from '../supabase';
import VideoOverlay from './VideoOverlay';
import EditProfileOverlay from './EditProfileOverlay';
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

/**
 * Generate a thumbnail image URL from a video URL (first frame)
 * @param {string} videoUrl - URL of the video
 * @returns {Promise<string>} - a Promise that resolves to a data URL image as thumbnail
 */
const generateThumbnail = (videoUrl) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.src = videoUrl;

    video.onloadedmetadata = () => {
      video.currentTime = 0;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgUrl = canvas.toDataURL('image/jpeg');
        resolve(imgUrl);
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = (error) => {
      reject(new Error('Failed to load video for thumbnail generation: ' + error.message));
    };
  });
};

const VideoThumbnail = ({ videoSrc }) => {
  const [thumbnail, setThumbnail] = useState(null);

  useEffect(() => {
    let isMounted = true;
    generateThumbnail(videoSrc)
      .then((imgUrl) => {
        if (isMounted) setThumbnail(imgUrl);
      })
      .catch((err) => {
        console.error('Thumbnail generation error:', err);
        setThumbnail(null);
      });
    return () => {
      isMounted = false;
    };
  }, [videoSrc]);

  if (!thumbnail) {
    return <div className="thumbnail-placeholder">Loading thumbnail...</div>;
  }

  return <img src={thumbnail} alt="Video Thumbnail" className="video-thumbnail-img" />;
};

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('Videos');
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [showEditOverlay, setShowEditOverlay] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          setDbUser(userDocSnap.exists() ? userDocSnap.data() : null);
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

  // Fetch videos based on active tab
  useEffect(() => {
    if (!user) return;

    const fetchUploadedVideos = async () => {
      setLoadingVideos(true);
      try {
        const videosQuery = query(
          collection(db, 'videos'),
          where('uploaderId', '==', user.uid),
          orderBy('uploadedAt', 'desc')
        );
        const videosSnapshot = await getDocs(videosQuery);
        const videosList = [];
        const videoIds = [];

        const usersSnapshot = await getDocs(collection(db, 'users'));

        for (const docSnap of videosSnapshot.docs) {
          const videoData = docSnap.data();
          const {
            uploaderId,
            caption,
            fileName,
            uploadedAt,
            views = 0,
            locked = false,
          } = videoData;
          const videoId = docSnap.id;
          videoIds.push(videoId);

          const uploaderDoc = usersSnapshot.docs.find((d) => d.id === uploaderId);
          const uploader = uploaderDoc
            ? uploaderDoc.data()
            : { displayname: 'Unknown', username: '@unknown', photoURL: null };

          const {
            data: { publicUrl },
          } = supabase.storage.from('videos').getPublicUrl(fileName);

          videosList.push({
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

        setVideos(videosList);

        if (videoIds.length === 0) {
          setTotalLikes(0);
          setLoadingVideos(false);
          return;
        }

        // Fetch total likes for uploaded videos
        const chunkSize = 10;
        let totalLikesCount = 0;

        for (let i = 0; i < videoIds.length; i += chunkSize) {
          const chunk = videoIds.slice(i, i + chunkSize);
          const likesQuery = query(
            collection(db, 'interactions'),
            where('type', '==', 'like'),
            where('videoId', 'in', chunk)
          );
          const likesSnapshot = await getDocs(likesQuery);
          totalLikesCount += likesSnapshot.size;
        }

        setTotalLikes(totalLikesCount);
      } catch (error) {
        console.error('Error fetching uploaded videos or likes:', error);
        setVideos([]);
      } finally {
        setLoadingVideos(false);
      }
    };

    const fetchLikedVideos = async () => {
      setLoadingVideos(true);
      try {
        // Step 1: fetch interactions of type 'like' by current user
        const likesQuery = query(
          collection(db, 'interactions'),
          where('userId', '==', user.uid),
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
              uploaderId,
              caption,
              fileName,
              uploadedAt,
              views = 0,
              locked = false,
            } = videoData;
            const videoId = docSnap.id;

            const uploaderDoc = usersSnapshot.docs.find((d) => d.id === uploaderId);
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
  }, [user, activeTab]);

  const handleProfileUpdate = (updatedData) => {
    setDbUser((prev) => ({ ...prev, ...updatedData }));
  };

  if (!user)
    return (
      <div className="profile-page-container">
        Please log in to see your profile.
      </div>
    );

  const displayname =
    dbUser?.displayname || user.displayname || 'Anonymous User';
  const usernameTag =
    dbUser?.username ||
    (user.displayname ? user.displayname.toLowerCase().replace(/\s+/g, '') : 'anonymous');

  const handleVideoClick = (video) => setSelectedVideo(video);
  const closeOverlay = () => setSelectedVideo(null);

  return (
    <div className="profile-page-container">
      <div className="profile-header-container">
        <div className="profile-avatar-large">
          {dbUser?.photoURL || user.photoURL ? (
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
            {/* Only Edit profile button as requested */}
            <button
              className="btn-edit-profile"
              onClick={() => setShowEditOverlay(true)}
            >
              Edit profile
            </button>
          </div>

          <div className="profile-stats">
            <span>
              <strong>{followingCount}</strong> Following
            </span>
            <span>
              <strong>{followersCount}</strong> Followers
            </span>
            <span>
              <strong>{totalLikes}</strong> Likes
            </span>
          </div>

          <div className="profile-bio">{dbUser?.bio || ''}</div>
        </div>
      </div>

      {/* Tabs only Videos and Liked as requested */}
      <nav className="profile-tabs">
        {['Videos', 'Liked'].map((tab) => (
          <button
            key={tab}
            className={`tab-item${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab}
          >
            {tab === 'Videos' && '📹 '}
            {tab === 'Liked' && '❤️ '}
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
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="video-card"
              title={video.caption}
              onClick={() => handleVideoClick(video)}
            >
              <VideoThumbnail videoSrc={video.videoSrc} />
              <div className="video-caption">{video.caption}</div>
            </div>
          ))}
        </section>
      )}

      {selectedVideo && (
        <VideoOverlay video={selectedVideo} onClose={closeOverlay} />
      )}

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
