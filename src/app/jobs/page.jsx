'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, MapPin, Calendar, Building2, Filter } from 'lucide-react';
import styles from './jobs.module.css';

const JobsPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedJobType, setSelectedJobType] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState([]);

  useEffect(() => {
    fetch('/api/jobs')
      .then((res) => res.json())
      .then((data) => {
        const today = new Date().toISOString().split('T')[0];
        const activeJobs = data.jobs.filter(
          (job) => job.active === 1 && job.lastdate_for_application >= today
        );
        setOrgs(data.orgs);
        setJobs(activeJobs);
        setAppliedJobs(data.appliedJobs || []);
        if (activeJobs.length > 0) setSelectedJob(activeJobs[0]);
      })
      .catch((error) => console.error('Error fetching jobs:', error));
  }, []);

  const handleOrgChange = (e) => {
    const orgid = e.target.value;
    setSelectedOrg(orgid);
    setSelectedJobType('');
    setSelectedLocation('');
    const filtered = jobs.filter((job) => (!orgid || job.orgid == orgid));
    setSelectedJob(filtered.length ? filtered[0] : null);
  };

  const handleJobTypeChange = (type) => {
    setSelectedJobType(type);
    const filtered = jobs.filter(
      (job) =>
        job.orgid == selectedOrg &&
        (!type || job.job_type === type) &&
        (!selectedLocation || (job.countryid === 185 ? job.state_value === selectedLocation : job.custom_state_name === selectedLocation))
    );
    setSelectedJob(filtered.length ? filtered[0] : null);
  };

  const handleLocationChange = (location) => {
    setSelectedLocation(location);
    const filtered = jobs.filter(
      (job) =>
        job.orgid == selectedOrg &&
        (!selectedJobType || job.job_type === selectedJobType) &&
        (!location || (job.countryid === 185 ? job.state_value === location : job.custom_state_name === location))
    );
    setSelectedJob(filtered.length ? filtered[0] : null);
  };

  const filteredJobs = selectedOrg ? jobs.filter((job) => job.orgid == selectedOrg) : jobs;
  const uniqueJobTypes = [...new Set(filteredJobs.map((job) => job.job_type))];
  const uniqueLocations = [...new Set(filteredJobs.map((job) => job.countryid === 185 ? job.state_value : job.custom_state_name).filter((loc) => loc))];

  return (
    <div className={styles.container}>
      <div className={styles.topFilter}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}><Filter size={16} /> Organization</label>
          <select className={styles.orgSelect} value={selectedOrg} onChange={handleOrgChange}>
            <option value="">All Organizations</option>
            {orgs.map((org) => (
              <option key={org.orgid} value={org.orgid}>{org.orgname}</option>
            ))}
          </select>
        </div>
        {selectedOrg && (
          <>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}><Filter size={16} /> Job Type</label>
              <div className={styles.buttonGroup}>
                <button
                  className={`${styles.filterButton} ${selectedJobType === '' ? styles.active : ''}`}
                  onClick={() => handleJobTypeChange('')}
                >
                  All
                </button>
                {uniqueJobTypes.map((type) => (
                  <button
                    key={type}
                    className={`${styles.filterButton} ${selectedJobType === type ? styles.active : ''}`}
                    onClick={() => handleJobTypeChange(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}><Filter size={16} /> Location</label>
              <div className={styles.buttonGroup}>
                <button
                  className={`${styles.filterButton} ${selectedLocation === '' ? styles.active : ''}`}
                  onClick={() => handleLocationChange('')}
                >
                  All
                </button>
                {uniqueLocations.map((location) => (
                  <button
                    key={location}
                    className={`${styles.filterButton} ${selectedLocation === location ? styles.active : ''}`}
                    onClick={() => handleLocationChange(location)}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.contentArea}>
        <div className={styles.jobsList}>
          {filteredJobs.length > 0 ? (
            filteredJobs
              .filter(
                (job) =>
                  (!selectedJobType || job.job_type === selectedJobType) &&
                  (!selectedLocation || (job.countryid === 185 ? job.state_value === selectedLocation : job.custom_state_name === selectedLocation))
              )
              .map((job) => (
                <div
                  key={job.jobid}
                  className={`${styles.jobCard} ${selectedJob?.jobid === job.jobid ? styles.selected : ''}`}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className={styles.jobTitle}><Briefcase size={16} /> {job.display_job_name}</div>
                  <div className={styles.jobDetailsWrapper}>
                    <span className={styles.jobDetailItem}>
                      <Building2 size={14} /> {job.orgname}
                    </span>
                    <span className={styles.jobDetailItem}>
                      <Briefcase size={14} /> {job.job_type}
                    </span>
                    <span className={styles.jobDetailItem}>
                      <MapPin size={14} /> {job.countryid === 185 ? job.state_value || 'N/A' : job.custom_state_name || 'N/A'}, {job.country_value || 'N/A'}
                    </span>
                  </div>
                  <div className={styles.jobDate}><Calendar size={14} /> Apply by: {job.lastdate_for_application}</div>
                  {appliedJobs.includes(job.jobid) ? (
                    <div className={styles.alreadyApplied}>Already Applied</div>
                  ) : (
                    <Link href={`/jobs/apply/${job.jobid}`}>
                      <button className={styles.applyInline}>Apply Now</button>
                    </Link>
                  )}
                </div>
              ))
          ) : (
            <p className={styles.noJobs}>No jobs available</p>
          )}
        </div>

        <div className={styles.jobDetails}>
          {selectedJob ? (
            <div className={styles.jobDetailsContent}>
              <h2 className={styles.jobDetailsTitle}>{selectedJob.display_job_name}</h2>
              <div className={styles.jobDetailsWrapper}>
                <span className={styles.jobDetailItem}>
                  <Building2 size={16} /> {selectedJob.orgname}
                </span>
                <span className={styles.jobDetailItem}>
                  <Briefcase size={16} /> {selectedJob.job_type}
                </span>
                <span className={styles.jobDetailItem}>
                  <MapPin size={16} /> {selectedJob.countryid === 185 ? selectedJob.state_value || 'N/A' : selectedJob.custom_state_name || 'N/A'}, {selectedJob.country_value || 'N/A'}
                </span>
              </div>
              <h3 className={styles.jobDetailsHeading}>Job Description</h3>
              <p className={styles.jobDetailsText}>{selectedJob.description}</p>
              {appliedJobs.includes(selectedJob.jobid) ? (
                <div className={styles.alreadyApplied}>Already Applied</div>
              ) : (
                <Link href={`/jobs/apply/${selectedJob.jobid}`}>
                  <button className={styles.applyBtn}>Apply Now</button>
                </Link>
              )}
            </div>
          ) : (
            <p className={styles.noJobs}>No job selected</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobsPage;