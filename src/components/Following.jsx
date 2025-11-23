import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import FollowedVideosFeed from './following-page';
import '../styles/home.css';

const Following = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <FollowedVideosFeed />
      <RightSidebar />
    </div>
  );
};

export default Following;