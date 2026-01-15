'use client';
import React, { useState } from 'react';
import styles from './Responses.module.css';
import { getSurveyAnalytics, getIndividualResponses } from '@/app/serverActions/Surveys/SurveyResponses/Responses';

const SurveyResponses = ({ initialSurveys }) => {
  const [view, setView] = useState('list'); // 'list' | 'details'
  const [activeTab, setActiveTab] = useState('combined'); // 'combined' | 'individual'
  
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [individualData, setIndividualData] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // --- ACTIONS ---

  const handleSurveyClick = async (survey) => {
      setLoadingDetails(true);
      setSelectedSurvey(survey);
      
      const [analyticsRes, individualRes] = await Promise.all([
          getSurveyAnalytics(survey.survey_id),
          getIndividualResponses(survey.survey_id)
      ]);

      if (analyticsRes.success) setAnalyticsData(analyticsRes.analytics);
      if (individualRes.success) setIndividualData(individualRes.individuals);
      
      setView('details');
      setLoadingDetails(false);
  };

  // --- HELPER: FORMAT QUESTION TYPE ---
  const formatQuestionType = (type) => {
      if (!type) return '';
      const lowerType = type.toLowerCase();
      
      if (lowerType === 'radio' || lowerType === 'multiple choice (single answer)') {
          return 'Multiple Choice (Single Answer)';
      }
      if (lowerType === 'checkbox' || lowerType === 'multiple choice (multiple answer)') {
          return 'Multiple Choice (Multiple Answer)';
      }
      if (lowerType === 'text') return 'Text Answer';
      if (lowerType === 'rating' || lowerType === 'rating scale') return 'Rating Scale';
      if (lowerType === 'star' || lowerType === 'star rating') return 'Star Rating';
      if (lowerType === 'slider' || lowerType === 'slider scale') return 'Slider Scale';
      
      return type; // Fallback
  };

  // --- RENDER HELPERS ---

  const renderCombinedTab = () => (
      <div>
          {analyticsData.map((q) => (
              <div key={q.question_id} className={styles.analyticsCard}>
                  <div className={styles.questionTitle}>
                      <span>Q. {q.question_text}</span>
                      
                      {/* UPDATED: Display Formatted Type */}
                      <span className={styles.typeBadge}>
                          {formatQuestionType(q.question_type)}
                      </span>
                      
                      <span style={{fontSize:'12px', color:'#666', fontWeight:'normal', marginLeft:'auto'}}>
                          ({q.totalResponses} responses)
                      </span>
                  </div>

                  {/* Visualization Logic */}
                  {(['radio', 'checkbox', 'rating', 'star', 'slider', 'Multiple Choice (Single Answer)', 'Multiple Choice (Multiple Answer)', 'Rating Scale', 'Star Rating', 'Slider Scale'].includes(q.question_type)) && (
                      <div>
                          {Object.entries(q.breakdown).length === 0 && <div style={{color:'#999', fontStyle:'italic'}}>No responses yet.</div>}
                          
                          {Object.entries(q.breakdown).map(([label, count]) => {
                              const percentage = q.totalResponses > 0 ? Math.round((count / q.totalResponses) * 100) : 0;
                              return (
                                  <div key={label} className={styles.barContainer}>
                                      <div className={styles.barLabel}>
                                          <span>{label}</span>
                                          <strong>{count} ({percentage}%)</strong>
                                      </div>
                                      <div className={styles.barWrapper}>
                                          <div className={styles.barFill} style={{width: `${percentage}%`}}></div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {/* Text Answers */}
                  {q.question_type === 'text' && (
                      <div className={styles.textGrid}>
                          {q.textAnswers.length === 0 ? <span style={{color:'#999'}}>No answers yet.</span> : null}
                          {q.textAnswers.map((ans, i) => (
                              <div key={i} className={styles.textCard}>"{ans}"</div>
                          ))}
                          {q.totalResponses > 5 && (
                              <div className={styles.textCard} style={{display:'flex', alignItems:'center', justifyContent:'center', background:'#e5e7eb'}}>
                                  +{q.totalResponses - 5} more
                              </div>
                          )}
                      </div>
                  )}
              </div>
          ))}
      </div>
  );

  const renderIndividualTab = () => (
      <div>
          {individualData.length === 0 && <div style={{textAlign:'center', padding:'20px'}}>No one has completed this survey yet.</div>}
          
          {individualData.map((person, idx) => (
              <div key={idx} className={styles.individualCard}>
                  <div className={styles.individualHeader}>
                      <div>
                          <div className={styles.personName}>{person.name}</div>
                          <div className={styles.personEmail}>{person.email}</div>
                      </div>
                  </div>
                  <div className={styles.answerList}>
                      {person.responses.map((res, i) => (
                          <div key={i} className={styles.answerItem}>
                              <div className={styles.qLabel}>
                                  Q: {res.question}
                              </div>
                              <div className={styles.aValue}>{res.answer}</div>
                          </div>
                      ))}
                  </div>
              </div>
          ))}
      </div>
  );

  // --- MAIN RENDER ---
  return (
    <div className={styles.container}>
        
        {/* LIST VIEW */}
        {view === 'list' && (
            <>
                <div className={styles.header}>
                    <h1 className={styles.title}>Survey Responses & Analytics</h1>
                    <p className={styles.subtitle}>Select a survey to view detailed reports.</p>
                </div>

                <div className={styles.grid}>
                    {initialSurveys.length === 0 && <div>No surveys created yet.</div>}
                    
                    {initialSurveys.map(s => (
                        <div key={s.survey_id} className={styles.card} onClick={() => handleSurveyClick(s)}>
                            <div>
                                <span className={styles.categoryBadge}>{s.category}</span>
                                <h3 className={styles.cardTitle}>{s.title}</h3>
                            </div>
                            
                            <div className={styles.statsRow}>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Assigned</span>
                                    <span className={styles.statValue}>{s.total_assigned}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Attempted</span>
                                    <span className={styles.statValue} style={{color: '#0fd46c'}}>{s.total_attempted}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Rate</span>
                                    <span className={styles.statValue}>
                                        {s.total_assigned > 0 ? Math.round((s.total_attempted / s.total_assigned) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}

        {/* DETAILS VIEW */}
        {view === 'details' && selectedSurvey && (
            <div className={styles.detailContainer}>
                
                {/* Detail Header */}
                <div className={styles.detailHeader}>
                    <div>
                        <h2 className={styles.title} style={{fontSize:'22px'}}>{selectedSurvey.title}</h2>
                        <span style={{color:'#666', fontSize:'14px'}}>
                            Attempted: <strong>{selectedSurvey.total_attempted}</strong> / {selectedSurvey.total_assigned}
                        </span>
                    </div>
                    <button className={styles.backBtn} onClick={() => setView('list')}>&larr; Back to List</button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <div 
                        className={`${styles.tab} ${activeTab === 'combined' ? styles.active : ''}`}
                        onClick={() => setActiveTab('combined')}
                    >
                        Combined Analytics
                    </div>
                    <div 
                        className={`${styles.tab} ${activeTab === 'individual' ? styles.active : ''}`}
                        onClick={() => setActiveTab('individual')}
                    >
                        Individual Responses
                    </div>
                </div>

                {/* Tab Content */}
                <div className={styles.tabContent}>
                    {loadingDetails ? (
                        <div style={{textAlign:'center', padding:'40px'}}>Loading data...</div>
                    ) : (
                        <>
                            {activeTab === 'combined' && renderCombinedTab()}
                            {activeTab === 'individual' && renderIndividualTab()}
                        </>
                    )}
                </div>

            </div>
        )}

    </div>
  );
};

export default SurveyResponses;