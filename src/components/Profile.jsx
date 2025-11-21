import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import ProfilePage from './ProfilePage'; // Import ProfilePage component
import '../styles/home.css';

const Profile = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <ProfilePage />
      <RightSidebar />
    </div>
  );
};

export default Profile;