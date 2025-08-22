'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import './Applications.css';

export default function Applications() {
  const [C_APPLICATIONS, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await fetch('/api/applications', {
          credentials: 'include', // Ensure cookies are sent
        });
        const data = await response.json();
        if (response.ok) {
          setApplications(data.C_APPLICATIONS);
        } else {
          setError(data.error || 'Failed to fetch C_APPLICATIONS');
        }
      } catch (err) {
        setError('Error fetching C_APPLICATIONS');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  if (loading) {
    return <div className="loading">Loading C_APPLICATIONS...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="C_APPLICATIONS-container">
      <h1 className="C_APPLICATIONS-title">My Applications</h1>
      {C_APPLICATIONS.length === 0 ? (
        <p className="no-C_APPLICATIONS">No C_APPLICATIONS found.</p>
      ) : (
        <div className="C_APPLICATIONS-table-container">
          <table className="C_APPLICATIONS-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Organization</th>
                <th>Job Title</th>
                <th>Applied Date</th>
                <th>Salary Expected</th>
                <th>Status</th>
                <th>Resume</th>
              </tr>
            </thead>
            <tbody>
              {C_APPLICATIONS.map((app) => (
                <tr key={app.applicationid}>
                  <td>{app.applicationid}</td>
                  <td>{app.orgname}</td>
                  <td>{app.display_job_name}</td>
                  <td>{new Date(app.applieddate).toLocaleDateString()}</td>
                  <td>${Number(app.salary_expected).toLocaleString()}</td>
                  <td className={`status-${app.status.toLowerCase()}`}>
                    {app.status}
                  </td>
                  <td>
                    {app.resumepath ? (
                      <Link href={app.resumepath} target="_blank" className="resume-link">
                        View Resume
                      </Link>
                    ) : (
                      'No resume'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}