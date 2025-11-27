import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { collection, getDocs, query, where, addDoc, orderBy, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import '../styles/commentOverlay.css';

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

const CommentOverlay = ({ videoId, isOpen, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchComments = async () => {
      if (!videoId || !isOpen) return;

      try {
        const commentsQuery = query(
          collection(db, 'interactions'),
          where('videoId', '==', videoId),
          where('type', '==', 'comment'),
          orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(commentsQuery);
        const commentList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch displayNames and photoURLs for each commenter
        const userIds = [...new Set(commentList.map(c => c.userId))];
        const userMap = {};
        for (const userId of userIds) {
          const userDoc = await getDoc(doc(db, 'users', userId));
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
        }

        // Attach displayName and photoURL to each comment
        commentList.forEach(comment => {
          comment.displayName = userMap[comment.userId].displayName;
          comment.photoURL = userMap[comment.userId].photoURL;
        });

        setComments(commentList);
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    fetchComments();
  }, [videoId, isOpen]);

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      alert('Please enter a comment.');
      return;
    }
    if (!currentUser) {
      alert('You must be logged in to comment.');
      return;
    }

    try {
      await addDoc(collection(db, 'interactions'), {
        userId: currentUser.uid,
        videoId,
        type: 'comment',
        commentText: newComment,
        timestamp: new Date(),
      });
      setNewComment('');

      // Refetch comments after adding (this will include the new comment with fetched displayName and photoURL)
      const commentsQuery = query(
        collection(db, 'interactions'),
        where('videoId', '==', videoId),
        where('type', '==', 'comment'),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(commentsQuery);
      const commentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch displayNames and photoURLs again
      const userIds = [...new Set(commentList.map(c => c.userId))];
      const userMap = {};
      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, 'users', userId));
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
      }

      commentList.forEach(comment => {
        comment.displayName = userMap[comment.userId].displayName;
        comment.photoURL = userMap[comment.userId].photoURL;
      });

      setComments(commentList);
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="overlayBackground" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="comments-title">
      <div className="overlayContent" onClick={e => e.stopPropagation()}>
        <header className="overlayHeader">
          <h3 id="comments-title">Comments ({comments.length.toLocaleString()})</h3>
          <button className="closeBtn" onClick={onClose} aria-label="Close comments overlay">&times;</button>
        </header>

        <div className="commentsList" tabIndex="0">
          {comments.length ? comments.map(comment => (
            <div key={comment.id} className="commentBox">
              <img 
                src={comment.photoURL || '/default-profile.png'}
                alt="User profile" 
                className="commentProfilePic"
                onError={e => { e.target.src = '/default-profile.png'; }}
              />
              <div className="commentContent">
                <div className="commentHeader">
                  <span className="commentUsername">{comment.displayName || 'Anonymous'}</span>
                  <span className="commentTimestamp">{formatTimestamp(comment.timestamp)}</span>
                </div>
                <p className="commentText">{comment.commentText}</p>
                <button className="replyBtn" disabled>Reply</button>
              </div>
            </div>
          )) : (
            <p className="noCommentsText">No comments yet.</p>
          )}
        </div>

        {currentUser ? (
          <section className="addCommentSection" aria-label="Add new comment">
            <textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              rows="3"
              className="commentInput"
            />
            <button type="button" className="postCommentBtn" onClick={handleAddComment}>Post Comment</button>
          </section>
        ) : (
          <p className="loginPrompt">You must be logged in to comment.</p>
        )}
      </div>
    </div>
  );
};

export default CommentOverlay;
