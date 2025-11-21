import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import MainContent from './Feed';
import '../styles/home.css';

const Home = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <MainContent />
      <RightSidebar />
    </div>
  );
};

export default Home;    