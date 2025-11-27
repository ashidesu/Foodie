import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, limit, startAfter, getDocs } from 'firebase/firestore';
import '../styles/chat-overlay.css'; 

const AirplaneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    style={{ transform: 'rotate(-45deg)' }} >
    <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="#e0e0e0"/>
  </svg>
);

const ChatOverlay = ({ currentUser, chatUser, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [preserveScroll, setPreserveScroll] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);

  // Function to fetch messages with pagination
  const fetchMessages = async (isInitial = false, oldestTimestamp = null) => {
    try {
      let sentQuery = query(
        collection(db, 'messages'),
        where('senderId', '==', currentUser.uid), 
        where('receiverId', '==', chatUser.id),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      let receivedQuery = query(
        collection(db, 'messages'),
        where('senderId', '==', chatUser.id),
        where('receiverId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      if (!isInitial && oldestTimestamp) {
        sentQuery = query(sentQuery, startAfter(oldestTimestamp));
        receivedQuery = query(receivedQuery, startAfter(oldestTimestamp));
      }

      const [sentSnapshot, receivedSnapshot] = await Promise.all([
        getDocs(sentQuery),
        getDocs(receivedQuery)
      ]);

      const sentMsgs = sentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const receivedMsgs = receivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const allMsgs = [...sentMsgs, ...receivedMsgs];
      allMsgs.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate()); // Sort desc (most recent first)

      let batchMsgs = allMsgs.slice(0, 10); // Take top 10 most recent

      if (batchMsgs.length < 10) {
        setHasMore(false);
      }

      batchMsgs.sort((a, b) => a.timestamp?.toDate() - b.timestamp?.toDate()); // Sort asc for display

      if (isInitial) {
        setMessages(batchMsgs);
        setLoading(false);
      } else {
        // Preserve scroll position when loading more
        prevScrollHeightRef.current = messagesContainerRef.current.scrollHeight;
        prevScrollTopRef.current = messagesContainerRef.current.scrollTop;
        setPreserveScroll(true);
        setMessages(prev => [...batchMsgs, ...prev]);
        setLoadingMore(false);
      }

      // Update lastTimestampRef to the oldest timestamp in this batch for next fetch
      if (batchMsgs.length > 0) {
        lastTimestampRef.current = batchMsgs[0].timestamp; // Oldest in asc order
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchMessages(true);

    // Real-time listener for new messages
    const sentMessagesQuery = query(
      collection(db, 'messages'),
      where('senderId', '==', currentUser.uid), 
      where('receiverId', '==', chatUser.id),
      orderBy('timestamp', 'asc')
    );

    const receivedMessagesQuery = query(
      collection(db, 'messages'),
      where('senderId', '==', chatUser.id),
      where('receiverId', '==', currentUser.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribeSent = onSnapshot(sentMessagesQuery, (sentSnapshot) => {
      const sentMsgs = sentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(prevMessages => {
        const filtered = prevMessages.filter(msg => msg.senderId !== currentUser.uid || msg.receiverId !== chatUser.id);
        const combined = [...filtered, ...sentMsgs];
        combined.sort((a, b) => a.timestamp?.toDate() - b.timestamp?.toDate());
        return combined;
      });
    });

    const unsubscribeReceived = onSnapshot(receivedMessagesQuery, (receivedSnapshot) => {
      const receivedMsgs = receivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(prevMessages => {
        const filtered = prevMessages.filter(msg => msg.senderId !== chatUser.id || msg.receiverId !== currentUser.uid);
        const combined = [...filtered, ...receivedMsgs];
        combined.sort((a, b) => a.timestamp?.toDate() - b.timestamp?.toDate());
        return combined;
      });
    });

    // Mark received messages as read
    const markAsRead = async () => {
      const receivedQuery = query(
        collection(db, 'messages'),
        where('senderId', '==', chatUser.id),
        where('receiverId', '==', currentUser.uid),
        where('read', '==', false)
      );
      const receivedSnapshot = await getDocs(receivedQuery);
      receivedSnapshot.forEach(async (docSnap) => {
        await updateDoc(docSnap.ref, { read: true });
      });
    };
    markAsRead();

    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, [currentUser.uid, chatUser.id]);

  // Handle scrolling behavior
  useLayoutEffect(() => {
    if (preserveScroll) {
      const newScrollHeight = messagesContainerRef.current.scrollHeight;
      const prevScrollHeight = prevScrollHeightRef.current;
      const prevScrollTop = prevScrollTopRef.current;
      messagesContainerRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
      setPreserveScroll(false);
    } else if (!loading && !loadingMore && messages.length > 0 && isAtBottom) {
      scrollToBottom();
    }
  }, [messages, loading, loadingMore, preserveScroll, isAtBottom]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10; // 10px threshold
    setIsAtBottom(atBottom);

    if (container.scrollTop === 0 && hasMore && !loadingMore) {
      setLoadingMore(true);
      fetchMessages(false, lastTimestampRef.current);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.uid,
        receiverId: chatUser.id,
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: false,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-overlay">
      <div className="chat-header">
        <h4>{chatUser.displayName}</h4>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div 
        className="chat-messages" 
        ref={messagesContainerRef} 
        onScroll={handleScroll}
      >
        {loadingMore && <p>Loading more messages...</p>}
        {loading ? (
          <p>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p>No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`}
            >
              <p>{msg.message}</p>
              <small>{msg.timestamp?.toDate().toLocaleTimeString()}</small>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          required
          autoComplete="off"
        />
        <button type="submit" aria-label="Send message">
          <AirplaneIcon />
        </button>
      </form>
    </div>
  );
};

export default ChatOverlay;
