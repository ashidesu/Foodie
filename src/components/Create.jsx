import React from 'react';
import LeftSidebar from './left-sidebar';
import RightSidebar from './right-sidebar';
import UploadPage from './upload-page';
import '../styles/home.css';

const Create = () => {
  return (
    <div className="layout">
      <LeftSidebar />
      <UploadPage />
      <RightSidebar />
    </div>
  );
};

export default Create;