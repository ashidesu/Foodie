import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import '../styles/chat-overlay.css'; // Add styles for the overlay

const ChatOverlay = ({ currentUser, chatUser, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null); // For auto-scrolling to bottom

  useEffect(() => {
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
      updateMessages(sentMsgs, 'sent');
    });

    const unsubscribeReceived = onSnapshot(receivedMessagesQuery, (receivedSnapshot) => {
      const receivedMsgs = receivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateMessages(receivedMsgs, 'received');
    });

    const updateMessages = (newMsgs, type) => {
      setMessages(prevMessages => {
        // Remove old messages of this type and add new ones, then sort
        const filtered = prevMessages.filter(msg => 
          !(type === 'sent' ? msg.senderId === currentUser.uid && msg.receiverId === chatUser.id : msg.senderId === chatUser.id && msg.receiverId === currentUser.uid)
        );
        const combined = [...filtered, ...newMsgs];
        combined.sort((a, b) => a.timestamp?.toDate() - b.timestamp?.toDate());
        setLoading(false);
        scrollToBottom();
        return combined;
      });
    };

    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, [currentUser.uid, chatUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-overlay">
      <div className="chat-header">
        <h4>Chat with {chatUser.displayName}</h4>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="chat-messages">
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
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatOverlay;
    