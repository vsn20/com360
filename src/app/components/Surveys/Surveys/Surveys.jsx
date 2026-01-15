'use client';
import React, { useState } from 'react';
import styles from './surveys.module.css'; 
import { getSurveyQuestionsAndResponses, submitSurveyResponses } from '@/app/serverActions/Surveys/Survey/Assignedsurvey';

// Accept initial data from Server Component
const Surveys = ({ initialSurveys, currentUser }) => {
  const [view, setView] = useState('list'); // 'list' | 'take_survey'
  
  // Initialize with passed data (Instant Load)
  const [surveys, setSurveys] = useState(initialSurveys || []);
  const [loading, setLoading] = useState(false); // No initial loading needed now
  
  // Taking Survey State
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); 
  const [submitting, setSubmitting] = useState(false);

  // --- ACTIONS ---

  const handleOpenSurvey = async (survey) => {
      // 1. Check Date Constraint
      if (survey.end_date) {
          const endDate = new Date(survey.end_date);
          const today = new Date();
          endDate.setHours(23, 59, 59, 999);
          today.setHours(0, 0, 0, 0);

          if (today > endDate) {
              return alert("This survey has expired and can no longer be edited.");
          }
      }

      setLoading(true);
      setActiveSurvey(survey);
      
      const res = await getSurveyQuestionsAndResponses(survey.survey_id);
      if (res.success) {
          setQuestions(res.questions);
          
          // Pre-fill answers if editing
          const initialAnswers = {};
          res.questions.forEach(q => {
              if (q.existingAnswer !== null && q.existingAnswer !== undefined) {
                  if(q.question_type === 'checkbox' || q.question_type === 'Multiple Choice (Multiple Answer)') {
                      initialAnswers[q.question_id] = q.existingAnswer.toString().split(',');
                  } else {
                      initialAnswers[q.question_id] = q.existingAnswer;
                  }
              }
          });
          setAnswers(initialAnswers);
          
          setView('take_survey');
      } else {
          alert("Failed to load questions");
      }
      setLoading(false);
  };

  const handleAnswerChange = (qId, value, type) => {
      if (type === 'checkbox' || type === 'Multiple Choice (Multiple Answer)') {
          const currentArr = answers[qId] || [];
          if (currentArr.includes(value)) {
              setAnswers({ ...answers, [qId]: currentArr.filter(v => v !== value) });
          } else {
              setAnswers({ ...answers, [qId]: [...currentArr, value] });
          }
      } else {
          setAnswers({ ...answers, [qId]: value });
      }
  };

  const handleSubmit = async () => {
      for (const q of questions) {
          if (q.is_required) {
              const val = answers[q.question_id];
              if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                  return alert(`Please answer the required question: "${q.question_text}"`);
              }
          }
      }

      if(!confirm("Are you sure you want to submit your responses?")) return;

      setSubmitting(true);
      const res = await submitSurveyResponses(activeSurvey.survey_id, answers);
      setSubmitting(false);

      if (res.success) {
          alert("Survey submitted successfully!");
          // Update local list status
          setSurveys(prev => prev.map(s => s.survey_id === activeSurvey.survey_id ? { ...s, assignment_status: 'COMPLETED' } : s));
          setView('list');
      } else {
          alert("Error: " + res.error);
      }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'No Deadline';

  // --- RENDER HELPERS ---
  const renderInteractiveQuestion = (q) => {
      const type = q.question_type || q.type; 
      const config = q.config || { max: 5, min: 0, step: 1 };
      let val = answers[q.question_id];

      const isRadio = type === 'radio' || type === 'Multiple Choice (Single Answer)';
      const isCheck = type === 'checkbox' || type === 'Multiple Choice (Multiple Answer)';
      const isText = type === 'text';
      const isRating = type === 'rating' || type === 'Rating Scale';
      const isStar = type === 'star' || type === 'Star Rating';
      const isSlider = type === 'slider' || type === 'Slider Scale';

      return (
          <div key={q.question_id} className={styles.Survey_Responses_questionCard}>
              <div className={styles.Survey_Responses_questionText}>
                  {q.question_text}
                  {q.is_required === 1 && <span className={styles.Survey_Responses_required}>*</span>}
              </div>

              {isText && (
                  <textarea 
                      className={styles.Survey_Responses_textarea} 
                      placeholder="Type your answer here..."
                      value={val || ''}
                      onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                  />
              )}

              {isRadio && q.options.map((opt, i) => (
                  <label key={i} className={styles.Survey_Responses_optionLabel}>
                      <input 
                          type="radio" 
                          name={`q_${q.question_id}`} 
                          className={styles.Survey_Responses_optionInput}
                          checked={val === opt}
                          onChange={() => handleAnswerChange(q.question_id, opt)}
                      />
                      {opt}
                  </label>
              ))}

              {isCheck && q.options.map((opt, i) => (
                  <label key={i} className={styles.Survey_Responses_optionLabel}>
                      <input 
                          type="checkbox" 
                          className={styles.Survey_Responses_optionInput}
                          checked={Array.isArray(val) && val.includes(opt)}
                          onChange={() => handleAnswerChange(q.question_id, opt, type)}
                      />
                      {opt}
                  </label>
              ))}

              {isRating && (
                  <div className={styles.Survey_Responses_ratingContainer}>
                      {Array.from({ length: parseInt(config.max || 5) }, (_, i) => i + 1).map(num => (
                          <div 
                              key={num} 
                              className={`${styles.Survey_Responses_ratingBox} ${parseInt(val) === num ? styles.Survey_Responses_ratingBox_selected : ''}`}
                              onClick={() => handleAnswerChange(q.question_id, num)}
                          >
                              {num}
                          </div>
                      ))}
                  </div>
              )}

              {isStar && (
                  <div className={styles.Survey_Responses_ratingContainer}>
                      {Array.from({ length: parseInt(config.max || 5) }, (_, i) => i + 1).map(num => (
                          <span 
                              key={num} 
                              className={`${styles.Survey_Responses_starIcon} ${parseInt(val) >= num ? styles.Survey_Responses_starIcon_active : ''}`}
                              onClick={() => handleAnswerChange(q.question_id, num)}
                          >
                              ★
                          </span>
                      ))}
                  </div>
              )}

              {isSlider && (
                  <div className={styles.Survey_Responses_sliderContainer}>
                      <input 
                          type="range" 
                          className={styles.Survey_Responses_slider}
                          min={config.min} 
                          max={config.max} 
                          step={config.step}
                          value={val || config.min}
                          onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                      />
                      <div className={styles.Survey_Responses_sliderLabels}>
                          <span>{config.min}</span>
                          <span style={{fontWeight:'bold', color:'#0fd46c', fontSize:'16px'}}>{val || config.min}</span>
                          <span>{config.max}</span>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className={styles.Survey_Responses_container}>
        
        {/* --- LIST VIEW --- */}
        {view === 'list' && (
            <>
                <div className={styles.Survey_Responses_header}>
                    <h1 className={styles.Survey_Responses_title}>My Assigned Surveys</h1>
                </div>

                {/* Only show loading if we are fetching details, initial load is instant */}
                {loading ? <div style={{textAlign:'center', padding:'60px', color:'#666'}}>Loading details...</div> : (
                    <div className={styles.Survey_Responses_grid}>
                        {surveys.length === 0 && <div style={{gridColumn:'1/-1', textAlign:'center', color:'#888', marginTop:'40px'}}>No surveys assigned to you yet.</div>}
                        
                        {surveys.map(s => {
                            const isExpired = s.end_date && new Date(s.end_date) < new Date(new Date().setHours(0,0,0,0));
                            return (
                                <div key={s.survey_id} className={styles.Survey_Responses_card}>
                                    <div>
                                        <div style={{marginBottom:'12px'}}>
                                            <span className={styles.Survey_Responses_categoryBadge}>{s.category}</span>
                                        </div>
                                        <h3 className={styles.Survey_Responses_cardTitle}>{s.title}</h3>
                                        
                                        <div className={styles.Survey_Responses_status} style={{
                                            backgroundColor: s.assignment_status === 'COMPLETED' ? '#f0fdf4' : '#fff7ed',
                                            color: s.assignment_status === 'COMPLETED' ? '#15803d' : '#c2410c'
                                        }}>
                                            {s.assignment_status}
                                        </div>

                                        <div className={styles.Survey_Responses_meta}>
                                            <span style={{fontWeight:'500', color:'#374151'}}>Deadline:</span> {formatDate(s.end_date)}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        className={styles.Survey_Responses_btnPrimary}
                                        style={{width:'100%', marginTop:'20px', backgroundColor: isExpired ? '#9ca3af' : '#0fd46c'}}
                                        onClick={() => handleOpenSurvey(s)}
                                        disabled={isExpired}
                                    >
                                        {isExpired ? 'Expired' : (s.assignment_status === 'COMPLETED' ? 'View / Edit' : 'Start Survey')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        )}

        {/* --- TAKE SURVEY VIEW --- */}
        {view === 'take_survey' && activeSurvey && (
            <div className={styles.Survey_Responses_formContainer}>
                <div style={{marginBottom:'40px', borderBottom:'1px solid #e5e7eb', paddingBottom:'20px'}}>
                    <h2 style={{margin:'0 0 10px 0', color:'#0fd46c', fontSize:'24px'}}>{activeSurvey.title}</h2>
                    <p style={{color:'#6b7280', margin:0, fontSize:'15px'}}>
                        {activeSurvey.category} • Due by {formatDate(activeSurvey.end_date)}
                    </p>
                </div>

                {questions.map(q => renderInteractiveQuestion(q))}

                <div className={styles.Survey_Responses_actions}>
                    <button 
                        className={`${styles.Survey_Responses_btn} ${styles.Survey_Responses_btnOutline}`} 
                        onClick={() => setView('list')}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button 
                        className={`${styles.Survey_Responses_btn} ${styles.Survey_Responses_btnPrimary}`} 
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? 'Saving...' : 'Submit Responses'}
                    </button>
                </div>
            </div>
        )}

    </div>
  );
};

export default Surveys;