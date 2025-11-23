import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import supabase from '../supabase';
import VideoOverlay from './VideoOverlay';
import '../styles/discover-page.css';

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
    video.crossOrigin = 'anonymous'; // Enable cross origin for public URLs
    video.preload = 'metadata';
    video.src = videoUrl;

    // When metadata is loaded, seek to 0 seconds
    video.onloadedmetadata = () => {
      video.currentTime = 0;
    };

    // When seeked to first frame, draw to canvas and export as data URL
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

    video.onerror = (err) => {
      reject(new Error('Error loading video for thumbnail generation: ' + err.message));
    };
  });
};

const DiscoverPage = () => {
  const [videos, setVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState({});
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], videos: [] });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRandomVideos = async () => {
      try {
        const videosQuery = query(
          collection(db, 'videos'),
          orderBy('uploadedAt', 'desc'),
          limit(20)
        );
        const videosSnapshot = await getDocs(videosQuery);
        const videosList = [];

        for (const doc of videosSnapshot.docs) {
          const videoData = doc.data();
          const { caption, fileName, uploadedAt, views = 0, locked = false, uploaderId } = videoData;
          const videoId = doc.id;

          const uploaderDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', uploaderId)));
          const uploaderData = uploaderDoc.docs[0]?.data() || {};

          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);

          videosList.push({
            videoId,
            videoSrc: publicUrl,
            caption: caption || 'Untitled Video',
            timeUploaded: uploadedAt ? timeAgo(uploadedAt.toDate()) : '',
            views,
            locked,
            uploaderName: uploaderData.displayName || 'Unknown',
            uploaderUsername: uploaderData.username || '@unknown',
            uploaderProfilePic: uploaderData.photoURL || null,
          });
        }
        setVideos(videosList);

        // Generate thumbnails for each video
        const thumbnails = {};
        await Promise.all(videosList.map(async (vid) => {
          try {
            const thumbnail = await generateThumbnail(vid.videoSrc);
            thumbnails[vid.videoId] = thumbnail;
          } catch (err) {
            console.error('Thumbnail error for video:', vid.videoId, err);
            thumbnails[vid.videoId] = null;
          }
        }));
        setVideoThumbnails(thumbnails);

      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoadingVideos(false);
      }
    };
    fetchRandomVideos();
  }, []);

  const handleSearchChange = async (e) => {
    const searchTerm = e.target.value;
    setSearchQuery(searchTerm);

    if (searchTerm.trim() === '') {
      setSearchResults({ users: [], videos: [] });
      return;
    }

    setLoadingSearch(true);
    try {
      const videosQuery = query(collection(db, 'videos'), orderBy('uploadedAt', 'desc'), limit(100));
      const videosSnapshot = await getDocs(videosQuery);
      const allVideos = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        caption: doc.data().caption || '',
        captionLower: (doc.data().caption || '').toLowerCase(),
      }));

      const matchingVideoIds = allVideos
        .filter(video => video.captionLower.includes(searchTerm.toLowerCase()))
        .slice(0, 10)
        .map(video => video.id);

      const searchedVideos = [];
      if (matchingVideoIds.length > 0) {
        const fullVideosQuery = query(collection(db, 'videos'), where('__name__', 'in', matchingVideoIds));
        const fullVideosSnapshot = await getDocs(fullVideosQuery);

        for (const doc of fullVideosSnapshot.docs) {
          const videoData = doc.data();
          const { caption, fileName, uploadedAt, views = 0, locked = false, uploaderId } = videoData;
          const videoId = doc.id;

          const uploaderDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', uploaderId)));
          const uploaderData = uploaderDoc.docs[0]?.data() || {};

          const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);

          searchedVideos.push({
            videoId,
            videoSrc: publicUrl,
            caption,
            timeUploaded: uploadedAt ? timeAgo(uploadedAt.toDate()) : '',
            views,
            locked,
            uploaderName: uploaderData.displayName || 'Unknown',
            uploaderUsername: uploaderData.username || '@unknown',
            uploaderProfilePic: uploaderData.photoURL || null,
          });
        }
      }

      // Generate thumbnails for searched videos
      const thumbnails = {};
      await Promise.all(searchedVideos.map(async (vid) => {
        try {
          const thumbnail = await generateThumbnail(vid.videoSrc);
          thumbnails[vid.videoId] = thumbnail;
        } catch (err) {
          console.error('Thumbnail error for video:', vid.videoId, err);
          thumbnails[vid.videoId] = null;
        }
      }));

      const usersQuery = query(collection(db, 'users'), orderBy('displayName'), limit(100));
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || '',
        displayNameLower: (doc.data().displayName || '').toLowerCase(),
        username: doc.data().username || '',
        photoURL: doc.data().photoURL || null,
      }));

      const matchingUserIds = allUsers
        .filter(user => user.displayNameLower.includes(searchTerm.toLowerCase()))
        .slice(0, 10)
        .map(user => user.id);

      const searchedUsers = [];
      if (matchingUserIds.length > 0) {
        const fullUsersQuery = query(collection(db, 'users'), where('__name__', 'in', matchingUserIds));
        const fullUsersSnapshot = await getDocs(fullUsersQuery);
        searchedUsers.push(...fullUsersSnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName || '',
          username: doc.data().username || '',
          photoURL: doc.data().photoURL || null,
        })));
      }

      setSearchResults({ users: searchedUsers, videos: searchedVideos });
      setVideoThumbnails(thumbnails);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleVideoClick = (video) => setSelectedVideo(video);
  const closeOverlay = () => setSelectedVideo(null);
  const handleUserClick = (userId) => navigate(`/ViewProfile/${userId}`);

  return (
    <div className="discover-page">
      <div className="discover-header">
        <h1>Discover</h1>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search users and videos..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="search-results">
          {loadingSearch ? (
            <p>Loading search results...</p>
          ) : (
            <>
              {searchResults.users.length > 0 && (
                <div className="search-section">
                  <h2>Users</h2>
                  <ul className="users-list">
                    {searchResults.users.map(user => (
                      <li
                        key={user.id}
                        className="user-item"
                        onClick={() => handleUserClick(user.id)}
                      >
                        <div className="user-avatar">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} />
                          ) : (
                            <div className="avatar-placeholder">{user.displayName?.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="user-text">
                          <span className="username">{user.displayName || 'Unknown'}</span>
                          <span className="handle">@{user.username || 'unknown'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {searchResults.videos.length > 0 && (
                <div className="search-section">
                  <h2>Videos</h2>
                  <div className="videos-grid">
                    {searchResults.videos.map(video => (
                      <div
                        key={video.videoId}
                        className="video-card"
                        onClick={() => handleVideoClick(video)}
                      >
                        <div
                          className="video-thumbnail"
                          style={{ backgroundImage: videoThumbnails[video.videoId] ? `url(${videoThumbnails[video.videoId]})` : `url(${video.videoSrc})` }}
                        >
                          <div className="video-views">{video.views}</div>
                          {video.locked && <div className="video-lock">🔒</div>}
                        </div>
                        <div className="video-info">
                          <p className="video-title">{video.caption}</p>
                          <p className="video-uploader">{video.uploaderName} ({video.uploaderUsername})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.users.length === 0 && searchResults.videos.length === 0 && (
                <p>No results found for "{searchQuery}".</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Main Videos Grid (when not searching) */}
      {!searchQuery && (
        <div className="videos-grid">
          {loadingVideos ? (
            <p>Loading videos...</p>
          ) : videos.length === 0 ? (
            <p>No videos available.</p>
          ) : (
            videos.map(video => (
              <div
                key={video.videoId}
                className="video-card"
                onClick={() => handleVideoClick(video)}
              >
                <div
                  className="video-thumbnail"
                  style={{ backgroundImage: videoThumbnails[video.videoId] ? `url(${videoThumbnails[video.videoId]})` : `url(${video.videoSrc})` }}
                >
                  <div className="video-views">{video.views}</div>
                  {video.locked && <div className="video-lock">🔒</div>}
                </div>
                <div className="video-info">
                  <div className="creator-info">
                    <div className="creator-avatar">
                      {video.uploaderProfilePic ? (
                        <img src={video.uploaderProfilePic} alt={video.uploaderName} />
                      ) : (
                        <div className="avatar-placeholder">{video.uploaderName.charAt(0)}</div>
                      )}
                    </div>
                    <div className="creator-details">
                      <h3 className="creator-name">{video.uploaderName}</h3>
                      <p className="creator-username">{video.uploaderUsername}</p>
                    </div>
                  </div>
                  <p className="video-title">{video.caption}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedVideo && <VideoOverlay video={selectedVideo} onClose={closeOverlay} />}
    </div>
  );
};

export default DiscoverPage;
