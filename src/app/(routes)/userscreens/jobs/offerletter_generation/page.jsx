export const dynamic = 'force-dynamic';

import React from 'react';
import DBconnection from '@/app/utils/config/db';
import { metaPool } from '@/app/utils/config/jobsdb'; // Import metaPool
import { cookies } from 'next/headers';
import Overview from '@/app/components/Jobs/OfferLetterGeneration/Overview';

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

const page = async () => {
  let orgid = null;
  let empid = null;
  let interviewdetails = [];
  let acceptingtime = [];
  let offerlettergenerated = [];

  try {
    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;
        empid = decoded.empid;

        // 1. Fetch Interview Details (Tenant DB - No Candidate Join)
        const [interviewRows] = await pool.query(
          `SELECT a.orgid, a.interview_id, a.application_id, b.status, b.candidate_id, e.display_job_name 
           FROM C_INTERVIEW_TABLES as a 
           JOIN C_APPLICATIONS as b on a.application_id = b.applicationid 
           JOIN C_EXTERNAL_JOBS AS e ON e.jobid = b.jobid 
           WHERE a.offer_letter_generated != 1 
           AND a.orgid = ? 
           AND a.interview_completed = 1 
           AND a.confirm = 1`,
          [orgid]
        );

        // 2. Fetch Accepting Time (Tenant DB)
        [acceptingtime] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 16 AND orgid = ? AND isactive = 1',
          [orgid]
        );

        // 3. Fetch Generated Offer Letters (Tenant DB - No Candidate Join)
        const [offerRows] = await pool.query(
          `SELECT a.orgid, a.interview_id, a.application_id, b.status, b.candidate_id, b.jobid, z.offerletter_url, e.display_job_name 
           FROM C_INTERVIEW_TABLES as a 
           JOIN C_APPLICATIONS as b on a.application_id = b.applicationid 
           JOIN C_EXTERNAL_JOBS AS e ON e.jobid = b.jobid 
           JOIN C_OFFER_LETTERS as z on z.applicationid = b.applicationid 
           WHERE a.offer_letter_generated = 1 
           AND a.orgid = ? 
           AND a.interview_completed = 1 
           AND a.confirm = 1`,
          [orgid]
        );

        // 4. Collect all Candidate IDs
        const allRows = [...interviewRows, ...offerRows];
        const candidateIds = [...new Set(allRows.map(r => r.candidate_id).filter(id => id))];

        let candidates = [];

        // 5. Fetch Candidate Details (Central DB / metaPool)
        if (candidateIds.length > 0) {
          try {
            const [candidateResults] = await metaPool.query(
              `SELECT cid, first_name, last_name FROM C_CANDIDATE WHERE cid IN (?)`,
              [candidateIds]
            );
            candidates = candidateResults;
          } catch (err) {
            console.error("Error fetching candidates from MetaPool:", err);
          }
        }

        // 6. Map Candidates to Data
        interviewdetails = interviewRows.map(row => {
          const candidate = candidates.find(c => String(c.cid) === String(row.candidate_id));
          return {
            ...row,
            first_name: candidate ? candidate.first_name : 'Unknown',
            last_name: candidate ? candidate.last_name : ''
          };
        });

        offerlettergenerated = offerRows.map(row => {
          const candidate = candidates.find(c => String(c.cid) === String(row.candidate_id));
          return {
            ...row,
            first_name: candidate ? candidate.first_name : 'Unknown',
            last_name: candidate ? candidate.last_name : ''
          };
        });
      }
    }
  } catch (error) {
    console.log("error in jobs-offerletter generation page", error);
  }

  return (
    <div>
      <Overview
        empid={empid}
        orgid={orgid}
        interviewdetails={interviewdetails}
        acceptingtime={acceptingtime}
        offerlettergenerated={offerlettergenerated}
      />
    </div>
  );
};

export default page;