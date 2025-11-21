import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Home from './components/Home';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to="/home" /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/home" /> : <Login />} 
        />
        <Route 
          path="/signup" 
          element={user ? <Navigate to="/home" /> : <Signup />} 
        />
        <Route 
          path="/home" 
          element={user ? <Home /> : <Navigate to="/login" 
          />} 
        />
      </Routes>
    </Router>
  );
}

export default App;