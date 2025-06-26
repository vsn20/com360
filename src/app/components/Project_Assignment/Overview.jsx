'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProjectsForAssignment } from '@/app/serverActions/ProjectAssignments/Overview';
import './overview.css';

const Overview = () => {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectData = await fetchProjectsForAssignment();
        setProjects(projectData);
        setError(null);
      } catch (err) {
        console.error('Error loading projects for assignment:', err);
        setError(err.message);
      }
    };
    loadProjects();
  }, []);

  const handleEdit = (PRJ_ID) => {
    router.push(`/userscreens/Project_Assign/edit/${PRJ_ID}`); // Updated to match case
  };

  return (
    <div className="overview-container">
      <h2>Project Assignments Overview</h2>
      {error && <div className="error-message">{error}</div>}
      {projects.length === 0 && !error ? (
        <p>No Projects found.</p>
      ) : (
        <table className="project-table">
          <thead>
            <tr>
              <th>Project ID</th>
              <th>Project Name</th>
              <th>Description</th>
              <th>Account</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.PRJ_ID}>
                <td>{project.PRJ_ID}</td>
                <td>{project.PRJ_NAME || '-'}</td>
                <td>{project.PRS_DESC || '-'}</td>
                <td>{project.ACCNT_ID || '-'}</td>
                <td>
                  <button className="edit-button" onClick={() => handleEdit(project.PRJ_ID)}>
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Overview;