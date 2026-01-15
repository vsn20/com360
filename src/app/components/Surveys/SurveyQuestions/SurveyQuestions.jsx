'use client';
import React, { useState } from 'react';
import './survey.css';
import { createSurvey, getSurveyDetails, saveFullSurvey } from '@/app/serverActions/Surveys/surveyActions';

const SurveyQuestions = ({ initialMySurveys, initialOrgSurveys, currentUser }) => {
  const [view, setView] = useState('list');
 const [mySurveys, setMySurveys] = useState([
    ...(initialMySurveys || []),
    ...(initialOrgSurveys || [])
  ]);
  
  // Builder Data
  const [activeSurvey, setActiveSurvey] = useState(null); 
  const [questions, setQuestions] = useState([]); 
  
  // UI State
  const [newSurvey, setNewSurvey] = useState({ title: '', category: '', endDate: '' });
  const [showQForm, setShowQForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [qType, setQType] = useState('text');
  
  // Form Data
  const [qData, setQData] = useState({ 
      text: '', 
      required: false, 
      options: ['Option 1', 'Option 2'],
      config: { max: 5, min: 0, step: 1 } 
  });

  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerData, setHeaderData] = useState({ title: '', category: '', endDate: '' });

  // --- DATE HELPERS ---

  // 1. For Display (Table/Label) -> DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB'); 
  };

  // 2. For Input Field -> YYYY-MM-DD
  const formatDateToInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // --- ACTIONS ---

  const handleCreateSurvey = async () => {
    if (!newSurvey.title || !newSurvey.category) return alert("Please fill Title and Category");
    
    const res = await createSurvey({ ...newSurvey, empid: currentUser.empid, orgid: currentUser.orgid });
    if (res.success) {
        const created = { survey_id: res.surveyId, ...newSurvey, created_by: currentUser.empid, is_active: 1 };
        setMySurveys([created, ...mySurveys]);
        
        // Setup Builder State
        setActiveSurvey(created);
        setHeaderData({
            title: created.title,
            category: created.category,
            endDate: created.endDate // Already in YYYY-MM-DD from the form
        });
        setQuestions([]);
        setView('builder');
        setNewSurvey({ title: '', category: '', endDate: '' });
    } else { alert("Error: " + res.error); }
  };

  const openBuilder = async (survey) => {
      setActiveSurvey(survey);
      
      // FIX: Normalize data immediately so Input works correctly
      setHeaderData({
          title: survey.title,
          category: survey.category,
          // Prioritize converting DB end_date to YYYY-MM-DD for the input
          endDate: formatDateToInput(survey.end_date || survey.endDate) 
      });

      const res = await getSurveyDetails(survey.survey_id);
      if (res.success) setQuestions(res.data);
      setView('builder');
      setIsEditingHeader(false);
      setShowQForm(false);
  };

  const openTool = (label) => {
      setQType(label);
      let defaultConfig = { max: 5, min: 0, step: 1 };
      if (label === 'Slider Scale') defaultConfig = { min: 0, max: 100, step: 1 };
      
      setQData({ text: '', required: false, options: ['Option 1', 'Option 2'], config: defaultConfig });
      setEditingIndex(null);
      setShowQForm(true);
  };

  const handleSaveLocalQuestion = () => {
      if (!qData.text) return alert("Question text is required");
      
      const newQuestion = {
          question_text: qData.text,
          question_type: qType,
          is_required: qData.required,
          options: ['Multiple Choice (Single Answer)', 'Multiple Choice (Multiple Answer)'].includes(qType) ? qData.options : [],
          config: qData.config 
      };

      if (editingIndex !== null) {
          const updated = [...questions];
          updated[editingIndex] = { ...updated[editingIndex], ...newQuestion };
          setQuestions(updated);
      } else {
          setQuestions([...questions, newQuestion]);
      }
      setShowQForm(false);
      setEditingIndex(null);
  };

  const handleEditQuestion = (index) => {
      const q = questions[index];
      let uiType = q.question_type;
      if(uiType === 'radio') uiType = 'Multiple Choice (Single Answer)';
      if(uiType === 'checkbox') uiType = 'Multiple Choice (Multiple Answer)';
      if(uiType === 'rating') uiType = 'Rating Scale';
      if(uiType === 'star') uiType = 'Star Rating';
      if(uiType === 'slider') uiType = 'Slider Scale';

      setQType(uiType);
      setQData({
          text: q.question_text,
          required: q.is_required,
          options: q.options || [],
          config: q.config || { max: 5, min: 0, step: 1 }
      });
      setEditingIndex(index);
      setShowQForm(true);
  };

  const handleDeleteQuestion = (index) => {
      if (!confirm("Delete this question?")) return;
      setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSaveFullSurvey = async () => {
      // headerData.endDate is already YYYY-MM-DD from the input, which is safe to send
      const res = await saveFullSurvey(activeSurvey.survey_id, headerData, questions);
      
      if(res.success) {
          alert("Survey Saved Successfully!");
          
          // Merge updates into active object
          const updatedSurveyInfo = { 
              ...activeSurvey, 
              title: headerData.title, 
              category: headerData.category, 
              end_date: headerData.endDate // Update local view property
          };
          
          setActiveSurvey(updatedSurveyInfo);
          
          // Update list view locally
          setMySurveys(prev => prev.map(s => s.survey_id === activeSurvey.survey_id ? updatedSurveyInfo : s));
          
          setIsEditingHeader(false);
      } else { alert("Failed to save: " + res.error); }
  };

  // --- RENDER HELPERS ---
  const renderStars = (count) => Array.from({ length: count }, (_, i) => <span key={i} className="star_icon">★</span>);
  const renderRatingBoxes = (count) => Array.from({ length: count }, (_, i) => <div key={i} className="rating_box">{i + 1}</div>);

  return (
    <div>
      {/* VIEW: LIST */}
      {view === 'list' && (
        <>
            <div className="survey_header_section">
                <h2 className="survey_title">Surveys</h2>
                <button className="survey_btn survey_btn_primary" onClick={() => setView('create')}>+ Create New Survey</button>
            </div>
            <div className="survey_table_wrapper">
                <table className="survey_table">
                    <thead>
                        <tr>
                            <th className="survey_th">Title</th>
                            <th className="survey_th">Category</th>
                            <th className="survey_th">End Date</th>
                            <th className="survey_th">Status</th>
                            {/* <th className="survey_th">Action</th> */}
                        </tr>
                    </thead>
                    <tbody>
                        {mySurveys.map(s => (
                            <tr key={s.survey_id} className="survey_tr" onClick={() => openBuilder(s)} style={{cursor:'pointer'}}>
                                <td className="survey_td"><strong>{s.title}</strong></td>
                                <td className="survey_td">{s.category}</td>
                                <td className="survey_td">{formatDate(s.end_date)}</td>
                                <td className="survey_td"><span className={`survey_badge ${s.is_active ? 'survey_badge_active' : 'survey_badge_inactive'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                                {/* <td className="survey_td"><button className="survey_btn survey_btn_primary survey_btn_sm" onClick={() => openBuilder(s)}>Edit / Build</button></td> */}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
      )}

      {/* VIEW: CREATE MODAL */}
      {view === 'create' && (
          <div className="survey_modal_overlay">
              <div className="survey_modal_content">
                  <div className="survey_modal_header"><h3>Create Survey</h3><button onClick={() => setView('list')} className="close_btn" style={{border:'none', background:'none', fontSize:'20px', cursor:'pointer'}}>&times;</button></div>
                  <div className="survey_modal_body">
                      <div className="survey_form_group"><label className="survey_label">Survey Name</label><input className="survey_input" value={newSurvey.title} onChange={e => setNewSurvey({...newSurvey, title: e.target.value})} /></div>
                      <div className="survey_form_group"><label className="survey_label">Category</label><input className="survey_input" value={newSurvey.category} onChange={e => setNewSurvey({...newSurvey, category: e.target.value})} /></div>
                      <div className="survey_form_group"><label className="survey_label">End Date</label><input type="date" className="survey_input" onChange={e => setNewSurvey({...newSurvey, endDate: e.target.value})} /></div>
                  </div>
                  <div className="survey_modal_footer"><button className="survey_btn survey_btn_danger" onClick={() => setView('list')} style={{marginRight:'10px'}}>Cancel</button><button className="survey_btn survey_btn_primary" onClick={handleCreateSurvey}>Create</button></div>
              </div>
          </div>
      )}

      {/* VIEW: BUILDER */}
      {view === 'builder' && (
          <div className="survey_builder_wrapper">
              <div className="survey_toolbox">
                  <h4 style={{marginTop:0, marginBottom:'15px'}}>Question Types</h4>
                  <button className="survey_tool_btn" onClick={() => openTool('Multiple Choice (Single Answer)')}>◎ Multiple Choice (Single)</button>
                  <button className="survey_tool_btn" onClick={() => openTool('Multiple Choice (Multiple Answer)')}>☑ Multiple Choice (Many)</button>
                  <button className="survey_tool_btn" onClick={() => openTool('text')}>✎ Text Box</button>
                  <button className="survey_tool_btn" onClick={() => openTool('Rating Scale')}>123 Rating Scale</button>
                  <button className="survey_tool_btn" onClick={() => openTool('Star Rating')}>★ Star Rating</button>
                  <button className="survey_tool_btn" onClick={() => openTool('Slider Scale')}>⸺ Slider Scale</button>
                  <button className="survey_btn survey_btn_outline" style={{width:'100%', marginTop:'20px'}} onClick={() => setView('list')}>&larr; Back to List</button>
              </div>

              <div className="survey_canvas">
                  
                  {/* --- HEADER SECTION --- */}
                  {isEditingHeader ? (
                       <div className="header_edit_form">
                           <div>
                               <label className="survey_label">Title</label>
                               <input className="survey_input" value={headerData.title} onChange={e => setHeaderData({...headerData, title: e.target.value})} />
                           </div>
                           <div>
                               <label className="survey_label">Category</label>
                               <input className="survey_input" value={headerData.category} onChange={e => setHeaderData({...headerData, category: e.target.value})} />
                           </div>
                           <div>
                               <label className="survey_label">End Date</label>
                               {/* FIX: Bind directly to headerData.endDate which is now YYYY-MM-DD */}
                               <input 
                                    type="date" 
                                    className="survey_input" 
                                    value={headerData.endDate} 
                                    onChange={e => setHeaderData({...headerData, endDate: e.target.value})} 
                               />
                           </div>
                           <button className="survey_btn survey_btn_primary" onClick={() => setIsEditingHeader(false)}>Done</button>
                       </div>
                  ) : (
                      <div className="survey_header_section" style={{marginTop:0, paddingTop:0, alignItems: 'flex-start'}}>
                          <div>
                            <h2 className="survey_title" style={{color: '#333'}}>{headerData.title}</h2>
                            <div style={{marginTop: '5px'}}>
                                <span className="survey_badge survey_badge_active">{headerData.category}</span>
                                {/* FIX: Display formatted date */}
                                <span style={{marginLeft:'10px', fontSize:'13px', color:'#666'}}>End Date: {formatDate(headerData.endDate)}</span>
                            </div>
                          </div>
                          <div style={{display:'flex', gap:'10px'}}><button className="survey_btn survey_btn_outline survey_btn_sm" onClick={() => setIsEditingHeader(true)}>Edit Header</button><button className="survey_btn survey_btn_primary" onClick={handleSaveFullSurvey}>Save Survey</button></div>
                      </div>
                  )}

                  {questions.length === 0 && !showQForm && <div style={{padding:'40px', textAlign:'center', color:'#888', border:'2px dashed #eee'}}>No questions added yet.</div>}

                  {questions.map((q, idx) => {
                      const type = q.question_type || q.type;
                      const cfg = q.config || { max: 5, min: 0, step: 1 };

                      return (
                      <div key={idx} className="survey_question_card" style={editingIndex === idx ? {borderColor: '#0fd46c'} : {}}>
                          <div className="survey_q_header">
                              <span className="survey_q_text">{idx + 1}. {q.question_text} {q.is_required ? <span style={{color:'red'}}>*</span> : ''}</span>
                              <div style={{display:'flex', gap:'5px'}}>
                                  <button onClick={() => handleEditQuestion(idx)} className="survey_btn_sm survey_btn_outline">Edit</button>
                                  <button onClick={() => handleDeleteQuestion(idx)} className="survey_btn_sm survey_btn_danger">Delete</button>
                              </div>
                          </div>
                          
                          <div className="survey_preview_area">
                              <div className="survey_preview_content">
                                  {type === 'text' && <input disabled className="survey_input" placeholder="User answer..." />}
                                  {['Multiple Choice (Single Answer)', 'radio'].includes(type) && q.options?.map((opt, i) => <div key={i}><label><input type="radio" disabled /> {opt}</label></div>)}
                                  {['Multiple Choice (Multiple Answer)', 'checkbox'].includes(type) && q.options?.map((opt, i) => <div key={i}><label><input type="checkbox" disabled /> {opt}</label></div>)}
                                  
                                  {['Rating Scale', 'rating'].includes(type) && (
                                      <div className="rating_scale_container">{renderRatingBoxes(parseInt(cfg.max || 5))}</div>
                                  )}
                                  {['Star Rating', 'star'].includes(type) && (
                                      <div className="star_rating_container">{renderStars(parseInt(cfg.max || 5))}</div>
                                  )}
                                  {['Slider Scale', 'slider'].includes(type) && (
                                      <div className="slider_container">
                                          <input type="range" min={cfg.min} max={cfg.max} step={cfg.step} className="slider_input" disabled />
                                          <div className="slider_labels"><span>{cfg.min}</span><span>{cfg.max}</span></div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  )})}

                  {showQForm && (
                      <div className="survey_add_form">
                          <h4 style={{marginTop:0}}>{editingIndex !== null ? 'Edit Question' : `Add ${qType}`}</h4>
                          <div className="survey_form_group"><input className="survey_input" autoFocus placeholder="Enter question text..." value={qData.text} onChange={e => setQData({...qData, text: e.target.value})} /></div>

                          {/* DYNAMIC CONFIG INPUTS */}
                          {['Rating Scale', 'Star Rating'].includes(qType) && (
                              <div className="survey_form_group">
                                  <label className="survey_label">Number of Levels/Stars (Max 10)</label>
                                  <select className="survey_input" value={qData.config.max} onChange={e => setQData({...qData, config: {...qData.config, max: e.target.value}})}>
                                      {[3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                                  </select>
                              </div>
                          )}

                          {qType === 'Slider Scale' && (
                              <div style={{display:'flex', gap:'10px'}}>
                                  <div className="survey_form_group"><label className="survey_label">Min</label><input type="number" className="survey_input" value={qData.config.min} onChange={e => setQData({...qData, config: {...qData.config, min: e.target.value}})} /></div>
                                  <div className="survey_form_group"><label className="survey_label">Max</label><input type="number" className="survey_input" value={qData.config.max} onChange={e => setQData({...qData, config: {...qData.config, max: e.target.value}})} /></div>
                                  <div className="survey_form_group"><label className="survey_label">Step</label><input type="number" className="survey_input" value={qData.config.step} onChange={e => setQData({...qData, config: {...qData.config, step: e.target.value}})} /></div>
                              </div>
                          )}

                          {['Multiple Choice (Single Answer)', 'Multiple Choice (Multiple Answer)'].includes(qType) && (
                             <div style={{marginBottom: '15px', paddingLeft: '10px', borderLeft: '3px solid #ddd'}}>
                                <label className="survey_label">Choices</label>
                                {qData.options.map((opt, i) => (
                                    <div key={i} className="survey_option_row">
                                        <span>{i+1}.</span>
                                        <input className="survey_input" value={opt} onChange={e => {
                                            const newOpts = [...qData.options]; newOpts[i] = e.target.value;
                                            setQData({...qData, options: newOpts});
                                        }} />
                                    </div>
                                ))}
                                <button className="survey_btn survey_btn_sm survey_btn_outline" onClick={() => setQData({...qData, options: [...qData.options, 'New Option']})}>+ Add Choice</button>
                             </div>
                          )}

                          <div className="survey_form_group"><label style={{display:'flex', gap:'5px'}}><input type="checkbox" checked={qData.required} onChange={e => setQData({...qData, required: e.target.checked})} /> Required Answer</label></div>
                          <div style={{display:'flex', gap:'10px', marginTop:'15px'}}><button className="survey_btn survey_btn_primary" onClick={handleSaveLocalQuestion}>{editingIndex !== null ? 'Update' : 'Add'}</button><button className="survey_btn survey_btn_danger" onClick={() => { setShowQForm(false); setEditingIndex(null); }}>Cancel</button></div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default SurveyQuestions;