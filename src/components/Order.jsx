import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import OrderPage from './order-page';
import '../styles/home.css';

const Explore    = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <OrderPage />
      <RightSidebar />
    </div>
  );
};

export default Explore;