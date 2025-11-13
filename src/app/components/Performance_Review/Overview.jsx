'use client'
import React from 'react'
import { useState, useEffect } from 'react';
import Reviews from './Reviews';
import Goals from './Goals';
import Summary from './Summary';
import './Overview.css';

const Overview = ({
  teamdata,
  individualdata,
  alldata, 
  permissionLevel,
  employees, // For Goals
  reviewEmployees, // For Reviews
  loggedInEmpId,
  orgid,
  goals,
  reviews // <-- 1. Receive new reviews prop
}) => {
    const [teamDataAccess, setTeamDataAccess] = useState(teamdata === 1);
    const [individualDataAccess, setIndividualDataAccess] = useState(individualdata === 1);
    const [allDataAccess, setAllDataAccess] = useState(alldata === 1);

    // Active tab state - default to 'summary'
    const [activeTab, setActiveTab] = useState('summary');
     
    const handleSummaryClick = () => {
      setActiveTab('summary');
    }
    
    const handleGoalsClick = () => {
      setActiveTab('goals');
    }

    const handleReviewsClick = () => {
      setActiveTab('reviews');
    }   

    const renderButtons = () => {
      // 'individual' can't see reviews.
      const canSeeReviews = allDataAccess || teamDataAccess;
      const canSeeGoals = allDataAccess || teamDataAccess || individualDataAccess;
      const canSeeSummary = canSeeGoals; 

      if (!canSeeSummary) {
        return <p>no access</p>;
      }

      return (
        <>
          <button 
            key="summary" 
            onClick={handleSummaryClick}
            className={activeTab === 'summary' ? 'active' : ''}
          >
            Summary
          </button>
          <button 
            key="goals" 
            onClick={handleGoalsClick}
            className={activeTab === 'goals' ? 'active' : ''}
          >
            Goals
          </button>
          {canSeeReviews && (
            <button 
              key="reviews" 
              onClick={handleReviewsClick}
              className={activeTab === 'reviews' ? 'active' : ''}
            >
              Reviews
            </button>
          )}
        </>
      );
    };

  return (
    <div>
      
      <div className="employee_performancereview-submenu-bar">
        {renderButtons()}
      </div>
      
      <div className="employee_performancereview-content">
        {activeTab === 'summary' && (
          <div>
            <Summary
              employees={employees}
              permissionLevel={permissionLevel}
              loggedInEmpId={loggedInEmpId}
            />
          </div>
        )}
        
        {activeTab === 'reviews' && (
          <div>
            <Reviews
              initialReviews={reviews}
              reviewEmployees={reviewEmployees}
              permissionLevel={permissionLevel}
              loggedInEmpId={loggedInEmpId}
              orgid={orgid}
            />
          </div>
        )}
        
        {activeTab === 'goals' && (
          <div>
            <Goals
              initialGoals={goals}
              employees={employees}
              permissionLevel={permissionLevel}
              loggedInEmpId={loggedInEmpId}
              orgid={orgid}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Overview