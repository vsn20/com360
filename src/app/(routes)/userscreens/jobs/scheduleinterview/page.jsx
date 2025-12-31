export const dynamic = 'force-dynamic';

import React from 'react';
import DBconnection from '@/app/utils/config/db';
import { metaPool } from '@/app/utils/config/jobsdb'; // ✅ Use metaPool for Candidates
import { cookies } from 'next/headers';
import Overview from '@/app/components/Jobs/ScheduleInterview/Overview';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const formatDate = (date) => {
    if (!date || date === '0000-00-00' || date === 'null') return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
};

const page = async () => {
  let orgid = null;
  let empid = null;
  let applieddetails = [];
  let scheduledetails = [];
  let time = [];

  try {
    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;
        empid = decoded.empid;
        
        // 1. Fetch Applied Applications (Tenant DB - No Candidate Join)
        const [appliedRows] = await pool.query(
          `SELECT a.applicationid, a.applieddate, a.jobid, o.display_job_name, a.status, a.candidate_id, a.resumepath 
           FROM C_APPLICATIONS a 
           LEFT JOIN C_EXTERNAL_JOBS o ON a.jobid = o.jobid AND a.orgid = o.orgid 
           WHERE a.orgid = ? AND status = ?`,
          [orgid, 'applied']
        );

        // 2. Fetch Scheduled/Other Applications (Tenant DB - No Candidate Join)
        const [scheduleRows] = await pool.query(
          `SELECT a.applicationid, a.applieddate, a.jobid, o.display_job_name, a.status, a.candidate_id, a.resumepath 
           FROM C_APPLICATIONS a 
           LEFT JOIN C_EXTERNAL_JOBS o ON a.jobid = o.jobid AND a.orgid = o.orgid 
           WHERE a.orgid = ? AND status != ?`,
          [orgid, 'applied']
        );

        // 3. Collect all Candidate IDs
        const allRows = [...appliedRows, ...scheduleRows];
        const candidateIds = [...new Set(allRows.map(r => r.candidate_id).filter(id => id))];

        let candidates = [];
        
        // 4. Fetch Candidate Details (Central DB / MetaPool)
        if (candidateIds.length > 0) {
           try {
             // Using metaPool directly as requested
             const [candidateResults] = await metaPool.query(
               `SELECT cid, first_name, last_name, email FROM C_CANDIDATE WHERE cid IN (?)`,
               [candidateIds]
             );
             candidates = candidateResults;
           } catch (err) {
             console.error("Error fetching candidates from MetaPool:", err);
           }
        }

        // 5. Map Candidates to Applications
        applieddetails = appliedRows.map(app => {
          const candidate = candidates.find(c => String(c.cid) === String(app.candidate_id));
          return {
            ...app,
            first_name: candidate ? candidate.first_name : 'Unknown',
            last_name: candidate ? candidate.last_name : '',
            applieddate: formatDate(app.applieddate)
          };
        });

        scheduledetails = scheduleRows.map(app => {
          const candidate = candidates.find(c => String(c.cid) === String(app.candidate_id));
          return {
            ...app,
            first_name: candidate ? candidate.first_name : 'Unknown',
            last_name: candidate ? candidate.last_name : '',
            applieddate: formatDate(app.applieddate)
          };
        });

        // 6. Fetch Time Options (Tenant DB - using com360_meta as requested)
        [time] = await pool.query(
          'SELECT id, Name FROM com360_meta WHERE g_id = 15 AND orgid = ? AND isactive = 1',
          [orgid]
        );
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }

  return (
    <div>
      <Overview
        scheduledetails={scheduledetails}
        applieddetails={applieddetails}
        orgid={orgid}
        empid={empid}
        time={time}
      />
    </div>
  );
};

export default page;