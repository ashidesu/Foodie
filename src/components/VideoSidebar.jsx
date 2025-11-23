// VideoSidebar.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Firebase configuration
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import CommentOverlay from './CommentOverlay';
import ReportOverlay from './report-overlay'; // NEW: Import the separated ReportOverlay component

// SVG Icon Components (unchanged)
const ProfileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
    <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clipRule="evenodd" />
  </svg>
);

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

const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="29" height="24" viewBox="0 0 29 24">
    <path fill="currentColor" d="M.408 22.528C2.281 15.77 6.08 10.995 11.624 8.434c1.678-.752 3.633-1.353 5.673-1.709l.151-.022c.462 0 .464-.014.464-3.352V0l11.446 11.446l-11.446 11.446V16.19H16.52a24.855 24.855 0 0 0-10.51 2.58l.145-.065a20.31 20.31 0 0 0-4.767 3.825l-.013.015l-1.374 1.454z" />
  </svg>
);

// NEW: Report Icon
const ReportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
    <path fillRule="evenodd" d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054a8.25 8.25 0 0 0 5.58.652l3.109-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.916.81l-3.109-.732a8.25 8.25 0 0 0-5.59.653l-.108.054a9.75 9.75 0 0 1-6.726.738l-1.838-.46V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Zm14.5 5a.75.75 0 0 0-1.5 0v7.5a.75.75 0 0 0 1.5 0v-7.5Zm-6 3a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm-4.5 3a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5Z" clipRule="evenodd" />
  </svg>
);

const VideoSidebar = ({ videoId }) => {
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isCommentOverlayOpen, setIsCommentOverlayOpen] = useState(false);
  const [isReportOverlayOpen, setIsReportOverlayOpen] = useState(false); // NEW: State for report overlay
  const [currentUser, setCurrentUser] = useState(null);
  const [uploaderId, setUploaderId] = useState(null);
  const [uploaderDbUser, setUploaderDbUser] = useState(null);

  const auth = getAuth();
  const navigate = useNavigate();

  // Listen for auth changes (unchanged)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, [auth]);

  // Fetch uploaderId and uploader's dbUser when videoId changes
  useEffect(() => {
    if (!videoId) {
      console.warn('No videoId provided to VideoSidebar');
      setUploaderId(null);
      setUploaderDbUser(null);
      return;
    }

    console.log('Fetching uploaderId for videoId:', videoId);

    const fetchUploaderData = async () => {
      try {
        const videoDocRef = doc(db, 'videos', videoId);
        const videoDocSnap = await getDoc(videoDocRef);
        if (videoDocSnap.exists()) {
          const data = videoDocSnap.data();
          console.log('Fetched data:', data);
          const fetchedUploaderId = data.uploaderId || null;
          setUploaderId(fetchedUploaderId);

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
          console.warn('Video document does not exist for videoId:', videoId);
          setUploaderId(null);
          setUploaderDbUser(null);
        }
      } catch (error) {
        console.error('Failed to get uploader data:', error);
        setUploaderId(null);
        setUploaderDbUser(null);
      }
    };

    fetchUploaderData();
  }, [videoId]);

  // Debug log for uploaderId state changes
  useEffect(() => {
    console.log('Set uploaderId to:', uploaderId);
  }, [uploaderId]);

  // Fetch likes/comments count and check if liked by current user (unchanged)
  useEffect(() => {
    if (!videoId) return;

    const fetchData = async () => {
      try {
        // Likes count
        const likesQuery = query(
          collection(db, 'interactions'),
          where('videoId', '==', videoId),
          where('type', '==', 'like')
        );
        const likesSnapshot = await getDocs(likesQuery);
        setLikesCount(likesSnapshot.size);

        // Comments count
        const commentsQuery = query(
          collection(db, 'interactions'),
          where('videoId', '==', videoId),
          where('type', '==', 'comment')
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        setCommentsCount(commentsSnapshot.size);

        // If logged in, check if user liked the video
        if (currentUser) {
          const userLikeQuery = query(
            collection(db, 'interactions'),
            where('userId', '==', currentUser.uid),
            where('videoId', '==', videoId),
            where('type', '==', 'like')
          );
          const userLikeSnapshot = await getDocs(userLikeQuery);
          setIsLiked(userLikeSnapshot.size > 0);
        } else {
          setIsLiked(false);
        }
      } catch (error) {
        console.error('Error fetching interactions:', error);
      }
    };

    fetchData();
  }, [videoId, currentUser]);

  // Toggle like (unchanged)
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
        where('videoId', '==', videoId),
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
          videoId,
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

  // Open comment overlay (unchanged)
  const handleOpenCommentOverlay = () => {
    setIsCommentOverlayOpen(true);
  };

  // Close comment overlay (unchanged)
  const handleCloseCommentOverlay = () => {
    setIsCommentOverlayOpen(false);
  };

  // NEW: Open report overlay
  const handleOpenReportOverlay = () => {
    setIsReportOverlayOpen(true);
  };

  // NEW: Close report overlay
  const handleCloseReportOverlay = () => {
    setIsReportOverlayOpen(false);
  };

  // NEW: Submit report
  const handleSubmitReport = async (reportData) => {
    try {
      const reportsRef = collection(db, 'reports');
      await addDoc(reportsRef, reportData);
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  };

  // Navigate to uploader's profile on profile icon click (unchanged)
  const handleGoToProfile = () => {
    if (uploaderId) {
      navigate(`/viewProfile/${uploaderId}`);
    } else {
      console.warn('Cannot navigate: uploaderId is null');
    }
  };

  return (
    <>
      <div className="sideBarDiv">
        <ul className="sideBar">
          <li onClick={handleGoToProfile} style={{ cursor: uploaderId ? 'pointer' : 'default' }} title="View Profile">
            <div className="iconContainer">
              {uploaderDbUser?.photoURL ? (
                <img
                  src={uploaderDbUser.photoURL}
                  alt="Profile"
                  className="profile-pic-icon"
                />
              ) : (
                <ProfileIcon />
              )}
            </div>
          </li>

          <li onClick={handleLike} style={{ cursor: 'pointer' }} title={isLiked ? 'Unlike' : 'Like'}>
            <div className="iconContainer">
              <HeartIcon isLiked={isLiked} />
              <span>{likesCount}</span>
            </div>
          </li>

          <li onClick={handleOpenCommentOverlay} style={{ cursor: 'pointer' }} title="Comments">
            <div className="iconContainer">
              <CommentIcon />
              <span>{commentsCount}</span>
            </div>
          </li>

          <li>
            <div className="iconContainer">
              <ShareIcon />
              <span>Share</span>
            </div>
          </li>

          {/* NEW: Report button */}
          <li onClick={handleOpenReportOverlay} style={{ cursor: 'pointer' }} title="Report">
            <div className="iconContainer">
              <ReportIcon />
              <span>Report</span>
            </div>
          </li>
        </ul>
      </div>

      <CommentOverlay
        videoId={videoId}
        isOpen={isCommentOverlayOpen}
        onClose={handleCloseCommentOverlay}
      />

      {/* NEW: Report Overlay */}
      <ReportOverlay
        isOpen={isReportOverlayOpen}
        onClose={handleCloseReportOverlay}
        onSubmit={handleSubmitReport}
        videoId={videoId}
        currentUser={currentUser}
      />
    </>
  );
};

export default VideoSidebar;