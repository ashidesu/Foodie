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
  documentId
} from 'firebase/firestore';
import supabase from '../supabase';
import { getRecommendedVideos } from './recommendationAlgorithm'; // Import the extracted algorithm
import VideoSidebar from './VideoSidebar';
import { useNavigate } from 'react-router-dom'; // Added for navigation
import '../styles/feed.css';

const MainContent = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendedVideos = async () => {
      setLoading(true);
      try {
        const userId = auth.currentUser?.uid;
        // Use the extracted algorithm
        const recommendedVideos = await getRecommendedVideos(userId);
        setVideos(recommendedVideos);
        setLoading(false);
      } catch (error) {
        console.error('Error loading recommended videos:', error);
        setLoading(false);
      }
    };

    fetchRecommendedVideos();
  }, []);

  if (loading) return <div>Loading videos...</div>;
  if (!videos.length) return <div>No videos available</div>;

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
  const navigate = useNavigate(); // Added for navigation

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
      // Autoplay failed; user can play manually by clicking
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

  const handleVisitRestaurant = () => {
    if (video.uploaderRestaurantId) {
      navigate(`/restaurant/${video.uploaderRestaurantId}`);
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
          {/* Restaurant Button */}
          {video.uploaderRestaurantId && (
            <button
              onClick={handleVisitRestaurant}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 10,
                background: 'rgba(0, 0, 0, 0.5)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              aria-label="Visit restaurant"
            >
              Visit Restaurant
            </button>
          )}
          <div className="uploaderDetails">
            <p className="uploaderName">{video.uploaderName}</p>
            <p className="uploaderUsername">{video.caption}</p>
            <p className="timeUploaded">{video.timeUploaded}</p>
          </div>
          <div className="playPauseOverlay" onClick={togglePlay} role="button" tabIndex={0} aria-label={isPlaying ? "Pause video" : "Play video"} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') togglePlay(); }}>
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

export default MainContent;