import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import DiscoverPage from './discover-page';
import '../styles/home.css';

const Explore = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <DiscoverPage />
      <RightSidebar />
    </div>
  );
};

export default Explore;