import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../styles/video-overlay.css';

// SVG Icon Components (copied from reference for consistency)
const HeartIcon = ({ isLiked }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isLiked ? "red" : "currentColor"} className="size-6">
    <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
  </svg>
);

const CommentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
    <path fillRule="evenodd" d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97.877.129 1.761.234 2.652.316V21a.75.75 0 0 0 1.28.53l4.184-4.183a.39.39 0 0 1 .266-.112c2.006-.05 3.982-.22 5.922-.506 1.978-.29 3.348-2.023 3.348-3.97V6.741c0-1.947-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
  </svg>
);

// Helper to format timestamps (time ago or mm-dd-yyyy)
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';

  const commentDate = timestamp.toDate();
  const now = new Date();
  const diffMs = now - commentDate;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours >= 24) {
    // Format as MM-DD-YYYY
    const month = (commentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = commentDate.getDate().toString().padStart(2, '0');
    const year = commentDate.getFullYear();
    return `${month}-${day}-${year}`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  }
  return 'just now';
};

// Helper to format upload date as mm-dd-yyyy
const formatDateMMDDYYYY = (date) => {
  if (!date) return '';
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

const VideoOverlay = ({ video, onClose }) => {
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uploaderId, setUploaderId] = useState(null);
  const [uploaderDbUser, setUploaderDbUser] = useState(null);
  const [uploadDate, setUploadDate] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  const auth = getAuth();
  const navigate = useNavigate();

  // Listen for auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, [auth]);

  // Fetch uploaderId, uploader's dbUser, and uploadDate when video changes
  useEffect(() => {
    if (!video || !video.videoId) {
      setUploaderId(null);
      setUploaderDbUser(null);
      setUploadDate(null);
      return;
    }

    const fetchUploaderData = async () => {
      try {
        const videoDocRef = doc(db, 'videos', video.videoId);
        const videoDocSnap = await getDoc(videoDocRef);
        if (videoDocSnap.exists()) {
          const data = videoDocSnap.data();
          const fetchedUploaderId = data.uploaderId || null;
          setUploaderId(fetchedUploaderId);
          setUploadDate(data.timestamp ? data.timestamp.toDate() : null); // Assuming timestamp is stored in Firestore

          if (fetchedUploaderId) {
            const uploaderDocRef = doc(db, 'users', fetchedUploaderId);
            const uploaderDocSnap = await getDoc(uploaderDocRef);
            if (uploaderDocSnap.exists()) {
              setUploaderDbUser(uploaderDocSnap.data());
            } else {
              setUploaderDbUser(null);
            }
          } else {
            setUploaderDbUser(null);
          }
        } else {
          setUploaderId(null);
          setUploaderDbUser(null);
          setUploadDate(null);
        }
      } catch (error) {
        console.error('Failed to get uploader data:', error);
        setUploaderId(null);
        setUploaderDbUser(null);
        setUploadDate(null);
      }
    };

    fetchUploaderData();
  }, [video]);

  useEffect(() => {
    if (!video || !video.videoId) {
      console.warn('VideoOverlay: No video prop provided or videoId missing');
      setLoading(false);
      return;
    }

    console.log('VideoOverlay: Starting fetch for videoId:', video.videoId);

    const fetchInteractionsAndComments = async () => {
      setLoading(true);
      try {
        // Create a timeout promise to prevent hanging
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout after 10 seconds')), 10000)
        );

        // Fetch likes count
        const likesQuery = query(
          collection(db, 'interactions'),
          where('videoId', '==', video.videoId),
          where('type', '==', 'like')
        );
        const likesPromise = getDocs(likesQuery);

        // Fetch comments details
        const commentsQuery = query(
          collection(db, 'interactions'),
          where('videoId', '==', video.videoId),
          where('type', '==', 'comment')
        );
        const commentsPromise = getDocs(commentsQuery);

        // Race against timeout
        const [likesSnapshot, commentsSnapshot] = await Promise.race([
          Promise.all([likesPromise, commentsPromise]),
          timeout
        ]);

        console.log('VideoOverlay: Fetched likes:', likesSnapshot.size, 'comments:', commentsSnapshot.size);

        setLikesCount(likesSnapshot.size);

        // Map comments data
        const commentsList = commentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch displayNames and photoURLs for each commenter
        const userIds = [...new Set(commentsList.map(c => c.userId))];
        const userPromises = userIds.map(userId => getDoc(doc(db, 'users', userId)));
        const userDocs = await Promise.all(userPromises);
        const userMap = {};
        userDocs.forEach((userDoc, index) => {
          const userId = userIds[index];
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userMap[userId] = {
              displayName: userData.displayname || 'Anonymous',
              photoURL: userData.photoURL || null,
            };
          } else {
            userMap[userId] = {
              displayName: 'Anonymous',
              photoURL: null,
            };
          }
        });

        // Attach displayName and photoURL to each comment
        commentsList.forEach(comment => {
          comment.displayName = userMap[comment.userId]?.displayName || 'Anonymous';
          comment.photoURL = userMap[comment.userId]?.photoURL || '/default-profile.png';
        });

        // Sort comments by timestamp descending
        commentsList.sort((a, b) => b.timestamp - a.timestamp);
        setComments(commentsList);

        // Check if liked by current user
        if (currentUser) {
          const userLikeQuery = query(
            collection(db, 'interactions'),
            where('userId', '==', currentUser.uid),
            where('videoId', '==', video.videoId),
            where('type', '==', 'like')
          );
          const userLikeSnapshot = await getDocs(userLikeQuery);
          setIsLiked(userLikeSnapshot.size > 0);
        } else {
          setIsLiked(false);
        }

      } catch (error) {
        console.error('VideoOverlay: Error fetching interactions/comments:', error);
        setLikesCount(0);
        setComments([]);
        setIsLiked(false);
      } finally {
        console.log('VideoOverlay: Fetch complete, setting loading to false');
        setLoading(false);
      }
    };

    fetchInteractionsAndComments();
  }, [video, currentUser]);

  // Toggle like
  const handleLike = async () => {
    if (!currentUser) {
      alert('You must be logged in to like videos.');
      return;
    }

    try {
      const interactionsRef = collection(db, 'interactions');
      const userLikeQuery = query(
        interactionsRef,
        where('userId', '==', currentUser.uid),
        where('videoId', '==', video.videoId),
        where('type', '==', 'like')
      );
      const userLikeSnapshot = await getDocs(userLikeQuery);

      if (userLikeSnapshot.size > 0) {
        const likeDoc = userLikeSnapshot.docs[0];
        await deleteDoc(likeDoc.ref);
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        await addDoc(interactionsRef, {
          userId: currentUser.uid,
          videoId: video.videoId,
          type: 'like',
        });
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Failed to like/unlike the video. Please try again.');
    }
  };

  // Navigate to uploader's profile
  const handleGoToProfile = () => {
    if (uploaderId) {
      navigate(`/viewProfile/${uploaderId}`);
    } else {
      console.warn('Cannot navigate: uploaderId is null');
    }
  };

  // Handle new comment submission
  const handleSubmitComment = async () => {
    if (!currentUser) {
      alert('You must be logged in to comment.');
      return;
    }
    if (!newCommentText.trim()) {
      alert('Comment cannot be empty.');
      return;
    }

    try {
      await addDoc(collection(db, 'interactions'), {
        userId: currentUser.uid,
        videoId: video.videoId,
        type: 'comment',
        commentText: newCommentText.trim(),
        timestamp: new Date(),
      });
      setNewCommentText('');

      // Refetch comments after adding
      const commentsQuery = query(
        collection(db, 'interactions'),
        where('videoId', '==', video.videoId),
        where('type', '==', 'comment')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsList = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch displayNames and photoURLs again
      const userIds = [...new Set(commentsList.map(c => c.userId))];
      const userPromises = userIds.map(userId => getDoc(doc(db, 'users', userId)));
      const userDocs = await Promise.all(userPromises);
      const userMap = {};
      userDocs.forEach((userDoc, index) => {
        const userId = userIds[index];
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userMap[userId] = {
            displayName: userData.displayname || 'Anonymous',
            photoURL: userData.photoURL || null,
          };
        } else {
          userMap[userId] = {
            displayName: 'Anonymous',
            photoURL: null,
          };
        }
      });

      commentsList.forEach(comment => {
        comment.displayName = userMap[comment.userId]?.displayName || 'Anonymous';
        comment.photoURL = userMap[comment.userId]?.photoURL || '/default-profile.png';
      });

      commentsList.sort((a, b) => b.timestamp - a.timestamp);
      setComments(commentsList);
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again.');
    }
  };

  if (!video) return null;

  return (
    <div className="video-overlay-container">
      <div className="video-overlay-backdrop" onClick={onClose} />
      <div className="video-overlay-content">
        <div className="video-player-section">
          <video
            className="overlay-video-player"
            controls
            autoPlay
            src={video.videoSrc}
            poster={video.thumbnailUrl}
          />
        </div>

        <div className="video-interactions-section">
          <div className="uploader-info-row" onClick={handleGoToProfile} style={{ cursor: uploaderId ? 'pointer' : 'default' }}>
            {video.uploaderProfilePic ? (
              <img
                className="uploader-avatar"
                src={video.uploaderProfilePic}
                alt={video.uploaderName}
              />
            ) : (
              <div className="avatar-placeholder">
                {video.uploaderName?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="uploader-details">
              <span className="nickname">{video.uploaderName}</span>
              <span className="upload-date">{formatDateMMDDYYYY(uploadDate)}</span>
            </div>
          </div>

          <div className="video-caption">
            <p>{video.caption}</p>
          </div>

          <div className="interaction-buttons">
            <button onClick={handleLike} className="interaction-btn" title={isLiked ? 'Unlike' : 'Like'}>
              <HeartIcon isLiked={isLiked} />
              <span>{loading ? '...' : likesCount}</span>
            </button>
            <button className="interaction-btn" title="Comments">
              <CommentIcon />
              <span>{loading ? '...' : comments.length}</span>
            </button>
          </div>

          <div className="comments-section">
            <div className="comments-list">
              {loading ? (
                <p>Loading comments...</p>
              ) : comments.length === 0 ? (
                <p>No comments yet.</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <img
                      className="comment-avatar"
                      src={comment.photoURL || '/default-profile.png'}
                      alt={comment.displayName}
                      onError={e => { e.target.src = '/default-profile.png'; }}
                    />
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-username">{comment.displayName}</span>
                        <span className="comment-timestamp">{formatTimestamp(comment.timestamp)}</span>
                      </div>
                      <p className="comment-text">{comment.commentText}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {currentUser ? (
              <div className="new-comment">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
                />
                <button onClick={handleSubmitComment}>Post</button>
              </div>
            ) : (
              <p className="login-prompt">You must be logged in to comment.</p>
            )}
          </div>
        </div>

        <button className="overlay-close-btn" onClick={onClose}>✕</button>
      </div>
    </div>
  );
};

export default VideoOverlay;
