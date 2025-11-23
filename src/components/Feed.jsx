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
import VideoSidebar from './VideoSidebar';
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

// Helper to chunk arrays for Firestore 'in' query (max 10)
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const MainContent = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendedVideos = async () => {
      setLoading(true);
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setVideos([]);
          setLoading(false);
          return;
        }

        const interactionsRef = collection(db, 'interactions');

        // 1. Get videoIds liked by the current user
        const userLikesQuery = query(
          interactionsRef,
          where('type', '==', 'like'),
          where('userId', '==', userId)
        );
        const userLikesSnap = await getDocs(userLikesQuery);
        const userLikedVideoIds = userLikesSnap.docs.map(doc => doc.data().videoId);

        if (userLikedVideoIds.length === 0) {
          // No likes yet, show random videos
          const randomVideosQuery = query(collection(db, 'videos'));
          const randomVideosSnap = await getDocs(randomVideosQuery);
          let videosList = await enrichVideos(randomVideosSnap.docs);
          // Shuffle the videos for randomness
          videosList = videosList.sort(() => Math.random() - 0.5);
          setVideos(videosList);
          setLoading(false);
          return;
        }

        // 2. Find other users who liked same videos (excluding current user)
        const similarUsersSet = new Set();
        const likedChunks = chunkArray(userLikedVideoIds, 10);
        for (const chunk of likedChunks) {
          const othersQuery = query(
            interactionsRef,
            where('type', '==', 'like'),
            where('videoId', 'in', chunk)
          );
          const othersSnap = await getDocs(othersQuery);
          othersSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.userId !== userId) {
              similarUsersSet.add(data.userId);
            }
          });
        }

        if (similarUsersSet.size === 0) {
          // No similar users, fallback to random videos
          const randomVideosQuery = query(collection(db, 'videos'));
          const randomVideosSnap = await getDocs(randomVideosQuery);
          let videosList = await enrichVideos(randomVideosSnap.docs);
          videosList = videosList.sort(() => Math.random() - 0.5);
          setVideos(videosList);
          setLoading(false);
          return;
        }

        // 3. Find videos liked by similar users
        const similarUsers = Array.from(similarUsersSet);
        const candidateVideoIdsSet = new Set();
        for (const userChunk of chunkArray(similarUsers, 10)) {
          const candidatesQuery = query(
            interactionsRef,
            where('type', '==', 'like'),
            where('userId', 'in', userChunk)
          );
          const candidatesSnap = await getDocs(candidatesQuery);
          candidatesSnap.docs.forEach(doc => {
            candidateVideoIdsSet.add(doc.data().videoId);
          });
        }

        // 4. Exclude videos user already liked
        userLikedVideoIds.forEach(id => candidateVideoIdsSet.delete(id));

        if (candidateVideoIdsSet.size === 0) {
          // No recommendations, fallback to random videos
          const randomVideosQuery = query(collection(db, 'videos'));
          const randomVideosSnap = await getDocs(randomVideosQuery);
          let videosList = await enrichVideos(randomVideosSnap.docs);
          videosList = videosList.sort(() => Math.random() - 0.5);
          setVideos(videosList);
          setLoading(false);
          return;
        }

        // 5. Fetch video documents for candidate videos (using documentId for querying doc IDs)
        const candidateVideoIds = Array.from(candidateVideoIdsSet);
        let recommendedVideos = [];
        for (const chunk of chunkArray(candidateVideoIds, 10)) {
          const candidateVideosQuery = query(
            collection(db, 'videos'),
            where(documentId(), 'in', chunk)
          );
          const candidateVideosSnap = await getDocs(candidateVideosQuery);
          const enriched = await enrichVideos(candidateVideosSnap.docs);
          recommendedVideos = recommendedVideos.concat(enriched);
        }

        // Sort by uploadedAt descending for recency
        recommendedVideos.sort((a, b) => b.uploadedAt - a.uploadedAt);

        setVideos(recommendedVideos);
        setLoading(false);

      } catch (error) {
        console.error('Error loading recommended videos:', error);
        setLoading(false);
      }
    };

    const enrichVideos = async (docs) => {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data()]));

      const videos = await Promise.all(docs.map(async (docSnap) => {
        const data = docSnap.data();
        const fileName = typeof data.fileName === 'string' ? data.fileName : '';

        // Get uploader info using uploaderId field
        const uploaderId = data.uploaderId;
        const uploader = usersMap.get(uploaderId) || {};

        const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(fileName);

        return {
          id: docSnap.id,
          videoSrc: (publicUrlData && publicUrlData.publicUrl) ? publicUrlData.publicUrl : '',
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