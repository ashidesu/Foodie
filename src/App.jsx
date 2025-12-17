import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Home from './components/Home';
import Following from './components/Following';
import Order from './components/Order';
import Create from './components/Create';
import Explore from './components/Explore';
import Profile from './components/Profile';
import ViewProfile from './components/ViewProfile';
import Restaurant from './components/Restaurant'
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';

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
          element={user ? <Home /> : <Navigate to="/login" />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/home/"
          element={user ? <Home /> : <Navigate to="/login" />}
        />

        <Route
          path="/following"
          element={<Following />} />

        <Route
          path="/order"
          element={<Order />} />

        <Route
          path="/create"
          element={<Create />} />

        <Route
          path="/explore"
          element={<Explore />} />
        <Route
          path="/profile"
          element={<Profile />} />
        <Route
          path="/viewProfile/:uploaderId"
          element={<ViewProfile />} />
        <Route
          path="/restaurant/:id"
          element={<Restaurant />} />
        <Route
          path="/onboarding"
          element={<Onboarding />}
        />
      </Routes>

    </Router>
  );
}

export default App;