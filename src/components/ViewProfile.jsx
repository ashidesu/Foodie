import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import ViewProfilePage from './view-profile-page'; // Import ProfilePage component
import '../styles/home.css';

const ViewProfile = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <ViewProfilePage />
      <RightSidebar />
    </div>
  );
};

export default ViewProfile;