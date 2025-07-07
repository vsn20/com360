'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, Building2, MapPin } from 'lucide-react';
import styles from './apply.module.css';

export default function ApplyPage() {
  const router = useRouter();
  const params = useParams();
  const [resume, setResume] = useState(null);
  const [message, setMessage] = useState('');
  const [jobDetails, setJobDetails] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const jobid = params.jobid;

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        const res = await fetch(`/api/jobs/fetchapplicationdetails/${jobid}`, {
          credentials: 'include' // Ensure cookies are sent
        });
        if (!res.ok) {
          throw new Error('Failed to fetch job details');
        }
        const data = await res.json();
        if (data.job) {
          setJobDetails(data.job);
          setHasApplied(data.hasApplied);
          if (data.hasApplied) {
            setMessage('You have already applied for this job.');
            setTimeout(() => router.push('/jobs/jobapplications'), 2000);
          }
        } else {
          setMessage('Job not found');
        }
      } catch (error) {
        setMessage('Error fetching job details');
      } finally {
        setLoading(false);
      }
    };

    if (jobid) {
      fetchJobDetails();
    } else {
      setMessage('Invalid job ID');
      setLoading(false);
    }
  }, [jobid, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (hasApplied) {
      setMessage('You have already applied for this job.');
      return;
    }

    if (!resume) {
      setMessage('Please upload a resume.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', resume);
    formData.append('jobid', jobid);

    try {
      const res = await fetch('/api/jobs/apply', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Ensure cookies are sent
      });

      const result = await res.json();
      if (result.success) {
        setMessage('Application submitted successfully!');
        setTimeout(() => router.push('/jobs/jobapplications'), 2000);
      } else {
        setMessage(result.error || 'Failed to apply.');
      }
    } catch (error) {
      setMessage('Something went wrong.');
    }
  };

  if (loading) {
    return <div className={styles.container}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Apply for {jobDetails?.jobtitle || 'Job'} #{jobid}
        </h2>
        {jobDetails && (
          <div className={styles.jobDetails}>
            <span className={styles.jobDetailItem}>
              <Building2 size={16} /> {jobDetails.orgname}
            </span>
            <span className={styles.jobDetailItem}>
              <Briefcase size={16} /> {jobDetails.type}
            </span>
            <span className={styles.jobDetailItem}>
              <MapPin size={16} /> {jobDetails.state_value || 'N/A'},{' '}
              {jobDetails.country_value || 'N/A'}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <div className={styles.formGroup}>
          <label className={styles.label}>Upload Resume (PDF only)</label>
          <input
            type="file"
            accept=".pdf"
            className={styles.fileInput}
            onChange={(e) => setResume(e.target.files[0])}
            required
            disabled={hasApplied}
          />
        </div>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={hasApplied}
        >
          Submit Application
        </button>
      </form>

      {message && (
        <p
          className={`${styles.message} ${
            message.includes('successfully') ? styles.success : styles.error
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}