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

  useEffect(() => {
    const fetchFollowedVideos = async () => {
      setLoading(true);
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setVideos([]);
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
          setLoading(false);
          return;
        }

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
  if (!videos.length) return <div>No videos uploaded by followed accounts.</div>;

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

export default FollowedVideosFeed;
