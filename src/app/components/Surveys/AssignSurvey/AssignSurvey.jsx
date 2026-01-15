'use client';
import React, { useState } from 'react';
import '../SurveyQuestions/survey.css';
import { getSurveyPreview, assignSurveyToEmployees, getExistingAssignments } from '@/app/serverActions/Surveys/AssignSurvey/Assignsurvey';

const AssignSurvey = ({ surveys, employees, currentUser }) => {
  const [view, setView] = useState('list');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  // Assignment State
  const [assignAll, setAssignAll] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]); // All checked IDs (new + old)
  const [alreadyAssignedIds, setAlreadyAssignedIds] = useState([]); // IDs that were already in DB
  const [loading, setLoading] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // --- ACTIONS ---

  const handleOpenAssign = async (survey) => {
    setLoading(true);
    setSelectedSurvey(survey);
    
    // Fetch Preview AND Existing Assignments in parallel
    const [previewRes, existingRes] = await Promise.all([
        getSurveyPreview(survey.survey_id),
        getExistingAssignments(survey.survey_id)
    ]);

    if(previewRes.success) {
        setQuestions(previewRes.data);
        
        // Handle Existing Assignments
        let dbAssignedIds = [];
        if (existingRes.success && Array.isArray(existingRes.assignedIds)) {
            dbAssignedIds = existingRes.assignedIds;
        }

        setAlreadyAssignedIds(dbAssignedIds);
        setSelectedEmpIds(dbAssignedIds); // Pre-check them

        // Auto-check "All" if everyone is already assigned
        if (employees.length > 0 && dbAssignedIds.length === employees.length) {
            setAssignAll(true);
        } else {
            setAssignAll(false);
        }

        setView('assign_view');
        setSearchQuery('');
    } else {
        alert("Failed to load details");
    }
    setLoading(false);
  };

  const handleAssignSubmit = async () => {
    // Determine new assignments (current selection minus already assigned)
    const newAssignments = selectedEmpIds.filter(id => !alreadyAssignedIds.includes(id));

    if (!assignAll && newAssignments.length === 0) {
        return alert("Please select at least one NEW employee to assign.");
    }

    if (!confirm(`Confirm assignment? Emails will be sent to newly assigned employees.`)) {
        return;
    }

    setLoading(true);
    const res = await assignSurveyToEmployees(
        selectedSurvey.survey_id,
        selectedEmpIds, // Send all selected; backend filters duplicates anyway
        currentUser.empid,
        currentUser.orgid,
        assignAll
    );

    setLoading(false);

    if (res.success) {
        alert(`Success! Assigned to ${res.count} new employees.`);
        setView('list');
    } else {
        alert("Error: " + res.error);
    }
  };

  // --- HELPERS ---
  const handleCheckboxChange = (empId) => {
    // Prevent unchecking if already assigned (though disabled input handles UI, logic safety here)
    if (alreadyAssignedIds.includes(empId)) return;

    if (selectedEmpIds.includes(empId)) {
        setSelectedEmpIds(selectedEmpIds.filter(id => id !== empId));
        setAssignAll(false);
    } else {
        setSelectedEmpIds([...selectedEmpIds, empId]);
    }
  };

  const handleSelectAllToggle = (e) => {
      const checked = e.target.checked;
      setAssignAll(checked);
      if (checked) {
          // Select all employees
          setSelectedEmpIds(employees.map(e => e.value));
      } else {
          // Unselect all EXCEPT already assigned ones (they stick)
          setSelectedEmpIds([...alreadyAssignedIds]);
      }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Filter Employees based on Search
  const filteredEmployees = employees.filter(emp => 
      emp.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRatingBoxes = (count) => Array.from({ length: count }, (_, i) => <div key={i} className="rating_box" style={{cursor:'default'}}>{i + 1}</div>);
  const renderStars = (count) => Array.from({ length: count }, (_, i) => <span key={i} className="star_icon" style={{cursor:'default'}}>★</span>);

  return (
    <div>
        {/* --- LIST VIEW --- */}
        {view === 'list' && (
            <>
                <div className="survey_header_section">
                    <h2 className="survey_title">Assign Surveys</h2>
                </div>
                <div className="survey_table_wrapper">
                    <table className="survey_table">
                        <thead>
                            <tr>
                                <th className="survey_th">Title</th>
                                <th className="survey_th">Category</th>
                                <th className="survey_th">End Date</th>
                                {/* <th className="survey_th">Action</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {surveys.map(s => (
                                <tr key={s.survey_id} className="survey_tr" onClick={() => handleOpenAssign(s)} style={{cursor:'pointer'}}>
                                    <td className="survey_td"><strong>{s.title}</strong></td>
                                    <td className="survey_td">{s.category}</td>
                                    <td className="survey_td">{formatDate(s.end_date)}</td>
                                    {/* <td className="survey_td">
                                        <button 
                                            className="survey_btn survey_btn_primary survey_btn_sm"
                                            onClick={() => handleOpenAssign(s)}
                                            disabled={loading}
                                        >
                                            {loading ? '...' : 'Assign'}
                                        </button>
                                    </td> */}
                                </tr>
                            ))}
                            {surveys.length === 0 && <tr><td colSpan="4" className="survey_td" style={{textAlign:'center'}}>No active surveys found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </>
        )}

        {/* --- ASSIGN VIEW --- */}
        {view === 'assign_view' && (
            <div className="survey_builder_wrapper">
                
                {/* LEFT: PREVIEW */}
                <div className="survey_canvas" style={{flex: 2, borderRight: '1px solid #eee'}}>
                    <div className="survey_header_section" style={{marginTop:0}}>
                        <div>
                            <h2 className="survey_title">{selectedSurvey.title}</h2>
                            <span className="survey_badge survey_badge_active">{selectedSurvey.category}</span>
                        </div>
                    </div>
                    {questions.length === 0 && <div className="text-gray-500 text-center mt-10">This survey has no questions.</div>}
                    <div style={{opacity: 0.8, pointerEvents: 'none'}}> 
                        {questions.map((q, idx) => {
                            const type = q.question_type || q.type;
                            const cfg = q.config || { max: 5, min: 0, step: 1 };
                            return (
                                <div key={idx} className="survey_question_card" style={{marginBottom: '15px'}}>
                                    <div className="survey_q_header">
                                        <span className="survey_q_text">{idx + 1}. {q.question_text} {q.is_required ? <span style={{color:'red'}}>*</span> : ''}</span>
                                    </div>
                                    <div className="survey_preview_area">
                                        {['text'].includes(type) && <input disabled className="survey_input" />}
                                        {['radio', 'checkbox'].includes(type) && q.options?.map((opt, i) => (
                                            <div key={i} style={{marginBottom:'5px'}}>
                                                <label><input type={type === 'radio' ? 'radio' : 'checkbox'} disabled /> {opt}</label>
                                            </div>
                                        ))}
                                        {['rating'].includes(type) && <div className="rating_scale_container">{renderRatingBoxes(parseInt(cfg.max || 5))}</div>}
                                        {['star'].includes(type) && <div className="star_rating_container">{renderStars(parseInt(cfg.max || 5))}</div>}
                                        {['slider'].includes(type) && (
                                            <div className="slider_container">
                                                <input type="range" className="slider_input" disabled />
                                                <div className="slider_labels"><span>{cfg.min}</span><span>{cfg.max}</span></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: ASSIGNMENT CONTROLS */}
                <div className="survey_toolbox" style={{width: '350px', display:'flex', flexDirection:'column'}}>
                    <h3 style={{marginTop:0, borderBottom:'1px solid #eee', paddingBottom:'10px'}}>Assign To</h3>
                    
                    {/* ALL EMPLOYEES TOGGLE */}
                    <div className="survey_form_group" style={{marginTop:'15px', marginBottom: '10px'}}>
                        <label className="survey_label" style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'15px', fontWeight:'bold', cursor:'pointer'}}>
                            <input 
                                type="checkbox" 
                                checked={assignAll} 
                                onChange={handleSelectAllToggle}
                                style={{transform:'scale(1.2)'}}
                            />
                            Select All Employees
                        </label>
                    </div>

                    {/* SEARCH BAR */}
                    <div style={{marginBottom: '10px'}}>
                        <input 
                            className="survey_input" 
                            placeholder="Search employees..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{padding: '8px', fontSize: '13px'}}
                        />
                    </div>

                    <div style={{borderTop:'1px solid #eee', margin:'5px 0'}}></div>

                    {/* EMPLOYEE LIST */}
                    <div style={{flex: 1, overflowY: 'auto', maxHeight: '500px'}}>
                        {filteredEmployees.map(emp => {
                            const isAlreadyAssigned = alreadyAssignedIds.includes(emp.value);
                            return (
                                <div key={emp.value} style={{marginBottom: '8px', padding:'5px', borderBottom:'1px solid #f9f9f9', backgroundColor: isAlreadyAssigned ? '#f5f5f5' : 'transparent'}}>
                                    <label style={{display:'flex', alignItems:'center', gap:'8px', cursor: isAlreadyAssigned ? 'not-allowed' : 'pointer', opacity: isAlreadyAssigned ? 0.7 : 1}}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedEmpIds.includes(emp.value)}
                                            disabled={isAlreadyAssigned} // Disable if already assigned
                                            onChange={() => handleCheckboxChange(emp.value)}
                                        />
                                        <div>
                                            <div style={{fontWeight:'500', fontSize:'13px'}}>
                                                {emp.label}
                                                {isAlreadyAssigned && <span style={{marginLeft:'5px', fontSize:'10px', color:'#0fd46c', fontWeight:'bold'}}>(Assigned)</span>}
                                            </div>
                                            <div style={{fontSize:'11px', color:'#888'}}>{emp.email}</div>
                                        </div>
                                    </label>
                                </div>
                            );
                        })}
                        {filteredEmployees.length === 0 && <div className="text-gray-500 text-center mt-4">No employees found.</div>}
                    </div>

                    <div style={{marginTop:'20px', display:'flex', gap:'10px'}}>
                        <button className="survey_btn survey_btn_danger" onClick={() => setView('list')} disabled={loading}>Cancel</button>
                        <button className="survey_btn survey_btn_primary" style={{flex:1}} onClick={handleAssignSubmit} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Assignments'}
                        </button>
                    </div>
                </div>

            </div>
        )}
    </div>
  );
};

export default AssignSurvey;