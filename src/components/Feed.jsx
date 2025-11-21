import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase'; // Assuming Firebase is configured
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore'; // Added doc and getDoc for better uploader fetching
import supabase from '../supabase';
import VideoSidebar from './VideoSidebar'; // Import the new VideoSidebar component
import '../styles/feed.css';

// Helper function to calculate time ago
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

const MainContent = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        // Fetch videos from Firestore, sorted by uploadedAt descending
        const videosQuery = query(collection(db, 'videos'), orderBy('uploadedAt', 'desc'));
        const videosSnapshot = await getDocs(videosQuery);
        const videosList = [];

        for (const docSnap of videosSnapshot.docs) {
          const videoData = docSnap.data();
          const { uploaderId, caption, fileName, uploadedAt } = videoData;
          const videoId = docSnap.id; // Use doc.id as the videoId

          // Fetch uploader info from 'users' collection (keyed by UID)
          let uploader = { displayname: 'Unknown', username: '@unknown', photoURL: null };
          if (uploaderId) {
            try {
              const uploaderDocRef = doc(db, 'users', uploaderId);
              const uploaderDocSnap = await getDoc(uploaderDocRef);
              if (uploaderDocSnap.exists()) {
                const uploaderData = uploaderDocSnap.data();
                uploader = {
                  displayname: uploaderData.displayname || 'Unknown',
                  username: uploaderData.username || '@unknown',
                  photoURL: uploaderData.photoURL || null,
                };
              }
            } catch (error) {
              console.error('Error fetching uploader:', error);
            }
          }

          // Get video URL from Supabase
          const { data: publicUrl } = supabase.storage.from('videos').getPublicUrl(fileName);

          videosList.push({
            id: videoId, // Pass the Firestore doc ID as videoId
            videoSrc: publicUrl?.publicUrl || '', // Safely extract URL
            caption,
            uploaderName: uploader.displayname,
            uploaderUsername: uploader.username,
            uploaderProfilePic: uploader.photoURL,
            timeUploaded: timeAgo(uploadedAt.toDate()),
          });
        }

        setVideos(videosList);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) return <div>Loading videos...</div>;

  return (
    <main className="main-content">
      {videos.map(video => (
        <VideoBox key={video.id} video={video} />
      ))}
    </main>
  );
};

// VideoBox component for individual videos (with auto-pause/play on scroll and manual control)
const VideoBox = ({ video }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // Track if video is in viewport
  const [isManuallyPaused, setIsManuallyPaused] = useState(false); // Track manual pause to prevent auto-play override
  const videoRef = useRef(null);

  // Intersection Observer for auto-play/pause on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting && !isPlaying && !isManuallyPaused) {
            // Auto-play only if in view, not playing, and not manually paused
            handlePlay();
          } else if (!entry.isIntersecting && isPlaying) {
            // Auto-pause when out of view
            handlePause();
          }
        });
      },
      { threshold: 0.5 } // Play when 50% of the video is visible
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current);
      }
    };
  }, [isPlaying, isManuallyPaused]); // Re-run if isPlaying or isManuallyPaused changes

  const handlePlay = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setIsPlaying(true);
      setIsManuallyPaused(false); // Reset manual pause on play
      console.log('Video played');
    } catch (error) {
      console.error('Video play failed:', error);
    }
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    console.log('Video paused');
  };

  const togglePlay = () => {
    if (isPlaying) {
      handlePause();
      setIsManuallyPaused(true); // Mark as manually paused
    } else {
      handlePlay();
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
            playsInline
            
            onClick={togglePlay}
          >
            <source src={video.videoSrc} type="video/mp4" />
          </video>
          <div className="uploaderDetails">
            <p className="uploaderName">{video.uploaderName}</p>
            <p className="uploaderUsername">{video.caption}</p>
            <p className="timeUploaded">{video.timeUploaded}</p>
          </div>
          <div className="playPauseOverlay" onClick={togglePlay}>
            {!isPlaying && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="48px" height="48px">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
        <VideoSidebar videoId={video.id} /> {/* Passes videoId to VideoSidebar */}
      </div>
    </div>
  );
};

export default MainContent;
