'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import './Applications.css';

export default function Applications() {
  const [applications, setApplications] = useState([]);
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
          setApplications(data.applications);
        } else {
          setError(data.error || 'Failed to fetch applications');
        }
      } catch (err) {
        setError('Error fetching applications');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  if (loading) {
    return <div className="loading">Loading applications...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="applications-container">
      <h1 className="applications-title">My Applications</h1>
      {applications.length === 0 ? (
        <p className="no-applications">No applications found.</p>
      ) : (
        <div className="applications-table-container">
          <table className="applications-table">
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
              {applications.map((app) => (
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