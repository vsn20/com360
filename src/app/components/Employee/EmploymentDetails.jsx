import React from 'react';

const formatDate = (date) => {
  if (!date) return '';
  // Handle YYYY-MM-DD format directly without creating Date object to avoid timezone issues
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-');
    return `${month}/${day}/${year}`;
  }
  // Fallback for other date formats
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
};

const EmploymentDetails = ({
  editing,
  setEditing,
  onCancel,
  formData,
  handleFormChange,
  onSave,
  employeeDetails,
  roles,
  selectedRoles,
  handleRoleToggle,
  isDropdownOpen,
  setIsDropdownOpen,
  statuses,
  jobTitles,
  payFrequencies,
  departments,
  workerCompClasses,
  allEmployees,
  suborgs,
  employmentTypes,
  canEdit,
  helpers,
  isSaving
}) => {
  const { 
    getRoleNames, 
    getStatusName, 
    getJobTitleName, 
    getPayFrequencyName, 
    getDepartmentName, 
    getWorkerCompClassName, 
    getSuperiorName, 
    getSuborgName 
  } = helpers;

  return (
    <div className="role-details-block96">
      <h3>Employment Details</h3>
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave('employment'); }}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="roleids">Roles: * (Click to select/deselect)</label>
              <div className="custom-select-container">
                <div
                  className={`custom-select ${isDropdownOpen ? 'open' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDropdownOpen(prev => !prev);
                  }}
                >
                  <div className="selected-value">
                    {selectedRoles.length > 0
                      ? selectedRoles
                        .map((id) => roles.find((r) => String(r.roleid) === String(id))?.rolename)
                        .filter(name => name)
                        .join(', ')
                      : 'Select Roles'}
                  </div>
                  {isDropdownOpen && (
                    <div className="options-container">
                      {roles.map((role) => (
                        <div
                          key={role.roleid}
                          className={`option ${selectedRoles.includes(role.roleid) ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRoleToggle(role.roleid);
                          }}
                        >
                          {role.rolename}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedRoles.length === 0 && (
                  <input type="hidden" name="roleids" value="" disabled />
                )}
                {selectedRoles.map((roleid) => (
                  <input key={roleid} type="hidden" name="roleids" value={roleid} />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Hire Date*</label>
              <input type="date" name="hireDate" value={formData.hireDate} onChange={handleFormChange} className="date-input" required />
            </div>
          </div>
          {/* ... Status, Job Title ... */}
          <div className="form-row">
            <div className="form-group">
              <label>Status*</label>
              <select name="status" value={formData.status} onChange={handleFormChange} required>
                <option value="">Select Status</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.Name}>
                    {status.Name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Job Title</label>
              <select name="jobTitle" value={formData.jobTitle} onChange={handleFormChange}>
                <option value="">Select Job Title</option>
                {jobTitles.map((job) => (
                  <option key={job.job_title_id} value={job.job_title_id}>
                    {`${job.job_title} (Level: ${job.level || 'N/A'}, Salary Range: ${job.min_salary || 'N/A'} - ${job.max_salary || 'N/A'})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* ... Pay Freq, Dept ... */}
          <div className="form-row">
            <div className="form-group">
              <label>Pay Frequency</label>
              <select name="payFrequency" value={formData.payFrequency} onChange={handleFormChange}>
                <option value="">Select Pay Frequency</option>
                {payFrequencies.map((freq) => (
                  <option key={freq.id} value={freq.Name}>
                    {freq.Name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <select name="deptId" value={formData.deptId} onChange={handleFormChange}>
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* ... Work Comp, Superior ... */}
          <div className="form-row">
            <div className="form-group">
              <label>Work Compensation Class</label>
              <select name="workCompClass" value={formData.workCompClass} onChange={handleFormChange}>
                <option value="">Select Work Compensation Class</option>
                {workerCompClasses.map((compClass) => (
                  <option key={compClass.class_code} value={compClass.class_code}>
                    {`${compClass.class_code} - ${compClass.phraseology}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Superior</label>
              <select name="superior" value={formData.superior} onChange={handleFormChange}>
                <option value="">Select a Superior (Optional)</option>
                {allEmployees
                  .filter(emp => emp.empid !== formData.empid)
                  .map((employee) => (
                    <option key={employee.empid} value={employee.empid}>
                      {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME} (${getRoleNames(employee.roleids || [employee.roleid])})`}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {/* ... Dates ... */}
          <div className="form-row">
            <div className="form-group">
              <label>Last Work Date</label>
              <input type="date" name="lastWorkDate" value={formData.lastWorkDate} onChange={handleFormChange} className="date-input" />
            </div>
            <div className="form-group">
              <label>Terminated Date</label>
              <input type="date" name="terminatedDate" value={formData.terminatedDate} onChange={handleFormChange} className="date-input" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rejoin Date</label>
              <input type="date" name="rejoinDate" value={formData.rejoinDate} onChange={handleFormChange} className="date-input" />
            </div>
            <div className="form-group">
              <label>Organization</label>
              <select
                name="suborgid"
                value={formData.suborgid}
                onChange={handleFormChange}
              >
                <option value="">Select Sub Organization</option>
                {suborgs.map((sub) => (
                  <option key={sub.suborgid} value={sub.suborgid}>
                    {sub.suborgname}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Employment Type</label>
              <select name="employment_type" value={formData.employment_type} onChange={handleFormChange}>
                <option value="">Select Employment Type</option>
                {employmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-buttons">
            {isSaving && <p style={{ color: '#007bff', marginBottom: '10px' }}>Saving changes, please wait...</p>}
            <button type="submit" className="save" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="cancel" onClick={onCancel} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="view-details">
          {/* ... (Existing view details) ... */}
          <div className="details-row">
            <div className="details-g">
              <label>Roles</label>
              <p>{getRoleNames(employeeDetails.roleids)}</p>
            </div>
            <div className="details-g">
              <label>Hire Date</label>
              <p>{employeeDetails.HIRE ? formatDate(employeeDetails.HIRE) : '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Status</label>
              <p>{getStatusName(employeeDetails.STATUS)}</p>
            </div>
            <div className="details-g">
              <label>Job Title</label>
              <p>{getJobTitleName(employeeDetails.JOB_TITLE)}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Pay Frequency</label>
              <p>{getPayFrequencyName(employeeDetails.PAY_FREQUENCY)}</p>
            </div>
            <div className="details-g">
              <label>Department</label>
              <p>{getDepartmentName(employeeDetails.DEPT_ID)}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Work Compensation Class</label>
              <p>{getWorkerCompClassName(employeeDetails.WORK_COMP_CLASS)}</p>
            </div>
            <div className="details-g">
              <label>Superior</label>
              <p>{getSuperiorName(employeeDetails.superior)}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Last Work Date</label>
              <p>{employeeDetails.LAST_WORK_DATE ? formatDate(employeeDetails.LAST_WORK_DATE) : '-'}</p>
            </div>
            <div className="details-g">
              <label>Terminated Date</label>
              <p>{employeeDetails.TERMINATED_DATE ? formatDate(employeeDetails.TERMINATED_DATE) : '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Rejoin Date</label>
              <p>{employeeDetails.REJOIN_DATE ? formatDate(employeeDetails.REJOIN_DATE) : '-'}</p>
            </div>
            <div className="details-g">
              <label>Organization</label>
              <p>{getSuborgName(employeeDetails.suborgid)}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Employment Type</label>
              <p>{employmentTypes.find(t => t.id == employeeDetails.employment_type)?.Name || '-'}</p>
            </div>
          </div>

          {canEdit && (
            <button className="button" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmploymentDetails;