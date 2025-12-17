import React from 'react';

const LeaveAssignments = ({
  editing,
  setEditing,
  formLeaves,
  handleLeaveChange,
  onSave,
  leaveAssignments,
  leaveTypes,
  canEdit
}) => {
  return (
    <div className="role-details-block96">
      <h3>Leave Assignments</h3>
      {editing ? (
        <div className="leaves-container">
          {leaveTypes.map((leave) => (
            <div key={leave.id} className="form-group">
              <label>{leave.Name} (Number of Leaves)</label>
              <input
                type="number"
                name={`noofleaves_${leave.id}`}
                value={formLeaves[leave.id] || ''}
                onChange={(e) => handleLeaveChange(leave.id, e.target.value)}
                min="0"
                step="any"
              />
            </div>
          ))}
          <div className="form-buttons">
            <button className="save" onClick={() => onSave('leaves')}>Save</button>
            <button className="cancel" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="view-leaves">
          {Object.keys(leaveAssignments).length === 0 ? (
            <p>No leave assignments.</p>
          ) : (
            leaveTypes.map((leave) => (
              leaveAssignments[leave.id] !== undefined && (
                <div key={leave.id} className="details-g">
                  <label>{leave.Name}</label>
                  <p>{leaveAssignments[leave.id] || '0'}</p>
                </div>
              )
            ))
          )}
          {canEdit && (
            <button className="button" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveAssignments;