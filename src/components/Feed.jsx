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
          // No likes yet, fallback to popular videos
          const popularVideosQuery = query(
            collection(db, 'videos'),
            orderBy('views', 'desc'),
            orderBy('uploadedAt', 'desc')
          );
          const popularVideosSnap = await getDocs(popularVideosQuery);
          const videosList = await enrichVideos(popularVideosSnap.docs);
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
          // No similar users, fallback again
          const popularVideosQuery = query(
            collection(db, 'videos'),
            orderBy('views', 'desc'),
            orderBy('uploadedAt', 'desc')
          );
          const popularVideosSnap = await getDocs(popularVideosQuery);
          const videosList = await enrichVideos(popularVideosSnap.docs);
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
          // No recommendations, fallback again
          const popularVideosQuery = query(
            collection(db, 'videos'),
            orderBy('views', 'desc'),
            orderBy('uploadedAt', 'desc')
          );
          const popularVideosSnap = await getDocs(popularVideosQuery);
          const videosList = await enrichVideos(popularVideosSnap.docs);
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
  const videoRef = useRef(null);

  // Track user interaction to allow autoplay
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
      setUserHasInteracted(true); // User clicked, allow future autoplay
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
            muted
            playsInline
            onClick={togglePlay}
            src={video.videoSrc}
          />
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

export default MainContent;
