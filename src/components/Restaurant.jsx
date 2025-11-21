    import React from 'react';
    import LeftSidebar from './left-sidebar';
    import RightSidebar from './right-sidebar';
    import RestaurantPage from './restaurant-page';
    import '../styles/home.css';

    const Restaurant = () => {
    return (
        <div className="layout">
        <LeftSidebar />
        <RestaurantPage />
        <RightSidebar />
        </div>
    );
    };

    export default Restaurant;    