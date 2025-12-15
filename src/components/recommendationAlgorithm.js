// recommendationAlgorithm.js
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

// Enrich video documents with uploader info and public URLs
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
      uploaderRestaurantId: uploader.restaurantId || null, // Added this line to include restaurantId
      timeUploaded: data.uploadedAt ? timeAgo(data.uploadedAt.toDate()) : '',
      views: data.views || 0,
      uploadedAt: data.uploadedAt ? data.uploadedAt.toDate() : new Date(0),
    };
  }));

  return videos;
};

// Main recommendation algorithm function
export const getRecommendedVideos = async (userId) => {
  if (!userId) {
    return [];
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
    return videosList;
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
    return videosList;
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
    return videosList;
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

  return recommendedVideos;
};
