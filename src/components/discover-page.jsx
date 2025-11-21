import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import supabase from '../supabase';
import VideoOverlay from './VideoOverlay'; // Assuming VideoOverlay is in the same directory
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

const DiscoverPage = () => {
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], videos: [] });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const navigate = useNavigate();

  // Fetch random videos on component mount (limit to 20 for performance)
  useEffect(() => {
    const fetchRandomVideos = async () => {
      try {
        const videosQuery = query(
          collection(db, 'videos'),
          orderBy('uploadedAt', 'desc'), // Order by recent; for true randomness, consider shuffling client-side or using a random field
          limit(20)
        );
        const videosSnapshot = await getDocs(videosQuery);
        const videosList = [];

        for (const doc of videosSnapshot.docs) {
          const videoData = doc.data();
          const { caption, fileName, uploadedAt, views = 0, locked = false, uploaderId } = videoData;
          const videoId = doc.id;

          // Fetch uploader details
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
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoadingVideos(false);
      }
    };
    fetchRandomVideos();
  }, []);

  // Handle search input change
  const handleSearchChange = async (e) => {
    const searchTerm = e.target.value;  // Renamed to avoid shadowing the imported 'query' function
    setSearchQuery(searchTerm);

    if (searchTerm.trim() === '') {
      setSearchResults({ users: [], videos: [] });
      return;
    }

    setLoadingSearch(true);
    try {
      // Fetch up to 100 videos for client-side filtering (adjust limit as needed for performance)
      const videosQuery = query(collection(db, 'videos'), orderBy('uploadedAt', 'desc'), limit(100));
      const videosSnapshot = await getDocs(videosQuery);
      const allVideos = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        caption: doc.data().caption || '',
        captionLower: (doc.data().caption || '').toLowerCase(),
      }));

      // Filter videos client-side for partial match (case-insensitive)
      const matchingVideoIds = allVideos
        .filter(video => video.captionLower.includes(searchTerm.toLowerCase()))
        .slice(0, 10)  // Limit to 10 results
        .map(video => video.id);

      // Fetch full details for matching video IDs
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

      // Fetch up to 100 users for client-side filtering (adjust limit as needed for performance)
      const usersQuery = query(collection(db, 'users'), orderBy('displayName'), limit(100));
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || '',
        displayNameLower: (doc.data().displayName || '').toLowerCase(),
      }));

      // Filter users client-side for partial match (case-insensitive)
      const matchingUserIds = allUsers
        .filter(user => user.displayNameLower.includes(searchTerm.toLowerCase()))
        .slice(0, 10)  // Limit to 10 results
        .map(user => user.id);

      // Fetch full details for matching user IDs
      const searchedUsers = [];
      if (matchingUserIds.length > 0) {
        const fullUsersQuery = query(collection(db, 'users'), where('__name__', 'in', matchingUserIds));
        const fullUsersSnapshot = await getDocs(fullUsersQuery);
        searchedUsers.push(...fullUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      setSearchResults({ users: searchedUsers, videos: searchedVideos });
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
                      <li key={user.id} className="user-item" onClick={() => handleUserClick(user.id)}>
                        <div className="user-avatar">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} />
                          ) : (
                            <div className="avatar-placeholder">{user.displayName?.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="user-info">
                          <span className="user-name">{user.displayName || 'Unknown'}</span>
                          <span className="user-username">@{user.username || 'unknown'}</span>
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
                          style={{ backgroundImage: `url(${video.videoSrc})` }}
                        >
                          <div className="video-views">▶ {video.views}</div>
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

      {/* Main Videos Grid (shown when not searching) */}
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
                  style={{ backgroundImage: `url(${video.videoSrc})` }}
                >
                  <div className="video-views">▶ {video.views}</div>
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
                  <div className="video-stats">
                    <div className="stat">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"></path>
                      </svg>
                      <span>{video.likes || 0}</span> {/* Assuming likes are fetched separately if needed */}
                    </div>
                    <div className="stat">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path>
                      </svg>
                      <span>{video.comments || 0}</span> {/* Assuming comments are fetched separately if needed */}
                    </div>
                    <div className="stat">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path>
                      </svg>
                      <span>{video.shares || 0}</span> {/* Assuming shares are fetched separately if needed */}
                    </div>
                  </div>
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
