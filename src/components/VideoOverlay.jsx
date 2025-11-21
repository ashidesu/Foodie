import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/video-overlay.css';

const VideoOverlay = ({ video, onClose }) => {
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!video) {
      console.warn('VideoOverlay: No video prop provided');
      setLoading(false);
      return;
    }

    if (!video.videoId) {
      console.warn('VideoOverlay: video.videoId is missing or undefined', video);
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
        const commentsList = commentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username || 'Anonymous',
            userProfilePic: data.userProfilePic || '/default-profile.png',
            commentText: data.commentText || '',
            timestamp: data.timestamp ? data.timestamp.toDate() : null,
          };
        });
        // Sort comments by timestamp descending
        commentsList.sort((a, b) => b.timestamp - a.timestamp);
        setComments(commentsList);

      } catch (error) {
        console.error('VideoOverlay: Error fetching interactions/comments:', error);
        setLikesCount(0);
        setComments([]);
      } finally {
        console.log('VideoOverlay: Fetch complete, setting loading to false');
        setLoading(false);
      }
    };

    fetchInteractionsAndComments();
  }, [video]);

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
          <div className="video-uploader-info">
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
            <div className="uploader-names">
              <span className="nickname">{video.uploaderName}</span>
              <span className="username">{video.uploaderUsername}</span>
            </div>
          </div>

          <div className="video-stats">
            <div><strong>{video.views}</strong> Views</div>
            <div><strong>{loading ? '...' : likesCount}</strong> Likes</div>
            <div><strong>{loading ? '...' : comments.length}</strong> Comments</div>
          </div>

          <div className="video-caption">
            <p>{video.caption}</p>
          </div>

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
                    src={comment.userProfilePic}
                    alt={comment.username}
                    onError={e => { e.target.src = '/default-profile.png'; }}
                  />
                  <div className="comment-content">
                    <span className="comment-username">{comment.username}</span>
                    <p className="comment-text">{comment.commentText}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <button className="overlay-close-btn" onClick={onClose}>✕</button>
      </div>
    </div>
  );
};

export default VideoOverlay;