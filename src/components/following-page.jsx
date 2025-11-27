import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import supabase from '../supabase';
import VideoSidebar from './VideoSidebar';
import { Navigate } from 'react-router-dom';  // Add this import
import '../styles/feed.css';

// Helper function to calculate "time ago"
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

// Helper to chunk arrays for Firestore 'in' query limit of 10
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const FollowedVideosFeed = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasFollowedAccounts, setHasFollowedAccounts] = useState(false);

  // Check if user is logged in; if not, redirect to login
  if (!auth.currentUser) {
    return <Navigate to="/login" />;
  }

  useEffect(() => {
    const fetchFollowedVideos = async () => {
      setLoading(true);
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setVideos([]);
          setHasFollowedAccounts(false);
          setLoading(false);
          return;
        }

        // 1. Get list of followed user IDs
        const connectionsRef = collection(db, 'connections');
        const followingQuery = query(connectionsRef, where('followerId', '==', userId));
        const followingSnapshot = await getDocs(followingQuery);
        const followedUserIds = followingSnapshot.docs.map(doc => doc.data().followedId);

        if (followedUserIds.length === 0) {
          setVideos([]);
          setHasFollowedAccounts(false);
          setLoading(false);
          return;
        }

        setHasFollowedAccounts(true);

        // 2. Fetch videos uploaded by followed users
        let videosList = [];
        const userIdChunks = chunkArray(followedUserIds, 10);

        for (const chunk of userIdChunks) {
          const videosQuery = query(
            collection(db, 'videos'),
            where('uploaderId', 'in', chunk),
            orderBy('uploadedAt', 'desc')
          );
          const videosSnapshot = await getDocs(videosQuery);

          const enrichedVideos = await enrichVideos(videosSnapshot.docs);
          videosList = videosList.concat(enrichedVideos);
        }

        // Sort by upload date descending
        videosList.sort((a, b) => b.uploadedAt - a.uploadedAt);

        setVideos(videosList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching followed videos:', error);
        setLoading(false);
      }
    };

    const enrichVideos = async (docs) => {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data()]));

      const videos = await Promise.all(docs.map(async (docSnap) => {
        const data = docSnap.data();
        const uploader = usersMap.get(data.uploaderId) || { displayname: 'Unknown', username: '@unknown', photoURL: null };
        const { data: publicUrl } = supabase.storage.from('videos').getPublicUrl(data.fileName);
        return {
          id: docSnap.id,
          videoSrc: publicUrl?.publicUrl || '',
          caption: data.caption || '',
          uploaderName: uploader.displayname || 'Unknown',
          uploaderUsername: uploader.username || '@unknown',
          uploaderProfilePic: uploader.photoURL || null,
          timeUploaded: data.uploadedAt ? timeAgo(data.uploadedAt.toDate()) : '',
          views: data.views || 0,
          uploadedAt: data.uploadedAt ? data.uploadedAt.toDate() : new Date(0),
        };
      }));

      return videos;
    };

    fetchFollowedVideos();
  }, []);

  if (loading) return <div>Loading followed videos...</div>;
  if (!hasFollowedAccounts) return <div className="no-following">No followed accounts.</div>;
  if (!videos.length) return <div className="no-following">No videos uploaded by followed accounts.</div>;

  return (
    <main className="main-content">
      {videos.map(video => (
        <VideoBox key={video.id} video={video} />
      ))}
    </main>
  );
};

const VideoBox = ({ video }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [volume, setVolume] = useState(0.5); // Start at 50% volume
  const [previousVolume, setPreviousVolume] = useState(0.5);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const handleUserInteraction = () => {
      setUserHasInteracted(true);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting && !isPlaying && !isManuallyPaused && userHasInteracted) {
            await handlePlay();
          } else if (!entry.isIntersecting && isPlaying) {
            handlePause();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, [isPlaying, isManuallyPaused, userHasInteracted]);

  const handlePlay = async () => {
    if (!videoRef.current) return;

    try {
      if (!hasViewed && auth.currentUser) {
        const videoDocRef = doc(db, 'videos', video.id);
        await updateDoc(videoDocRef, {
          views: increment(1),
        });
        setHasViewed(true);
      }

      await videoRef.current.play();
      setIsPlaying(true);
      setIsManuallyPaused(false);
    } catch (error) {
      console.warn('Video play failed:', error);
    }
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      handlePause();
      setIsManuallyPaused(true);
    } else {
      setUserHasInteracted(true);
      handlePlay();
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
      if (videoRef.current) {
        videoRef.current.volume = 0;
        videoRef.current.muted = true;
      }
    } else {
      const newVolume = previousVolume > 0 ? previousVolume : 0.5;
      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        videoRef.current.muted = false;
      }
    }
  };

  const getVolumeIcon = () => {
    if (volume === 0) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M3 9v6h4l5 5V4L7 9H3z" />
          <line x1="22" y1="9" x2="16" y2="15" stroke="white" strokeWidth="2" />
          <line x1="16" y1="9" x2="22" y2="15" stroke="white" strokeWidth="2" />
        </svg>
      );
    } else if (volume < 0.5) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
      );
    } else {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      );
    }
  };

  return (
    <div className='videoBox'>
      <div className='videoContainer'>
        <div className="videoBorder">
          <video
            ref={videoRef}
            preload="auto"
            loop
            muted={volume === 0}
            playsInline
            onClick={togglePlay}
            src={video.videoSrc}
          />
          {/* Volume Control */}
          <div
            className="volume-control"
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
          >
            <button
              onClick={toggleMute}
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Toggle mute"
            >
              {getVolumeIcon()}
            </button>
            {isVolumeHovered && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                style={{
                  width: '80px',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: '2px',
                  outline: 'none',
                  cursor: 'pointer',
                  marginLeft: '8px',
                }}
                aria-label="Volume slider"
              />
            )}
          </div>
          <div className="uploaderDetails">
            <p className="uploaderName">{video.uploaderName}</p>
            <p className="uploaderUsername">{video.caption}</p>
            <p className="timeUploaded">{video.timeUploaded}</p>
          </div>
          <div className="playPauseOverlay" onClick={togglePlay}>
            {!isPlaying && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="48" height="48">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
        <VideoSidebar videoId={video.id} />
      </div>
    </div>
  );
};

export default FollowedVideosFeed;
