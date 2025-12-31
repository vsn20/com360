export const dynamic = 'force-dynamic';

import React from 'react';
import Overview from '@/app/components/Jobs/Interview/Overview';
import DBconnection from '@/app/utils/config/db'; // Tenant Connection
import { metaPool } from '@/app/utils/config/jobsdb'; // ✅ Central Meta Connection
import { cookies } from 'next/headers';

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
  let time = [];
  let acceptingtime = [];
  let editing = 0;

  try {
    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;
        empid = decoded.empid;

        const [features] = await pool.query(
          `SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?`,
          [empid, orgid]
        );
        const roleids = features.map((details) => details.roleid);
        let menuresults = [];
        if (roleids.length > 0) {
          [menuresults] = await pool.query(
            `SELECT alldata FROM C_ROLE_MENU_PERMISSIONS WHERE roleid IN (?) AND menuid = 12 AND submenuid = 17 AND alldata = 1`,
            [roleids]
          );
        }

        const allpermissions = menuresults.length > 0;
        editing = allpermissions ? 1 : 0;

        // 1. Fetch Interview Data (From Tenant DB)
        let rows = [];
        const baseQuery = `
          SELECT i.interview_id, i.application_id, i.interview_completed, i.start_date, i.start_time, i.start_am_pm, i.end_date,
                 a.jobid, a.status, a.applicationid, a.candidate_id, 
                 e.display_job_name 
          FROM C_INTERVIEW_TABLES AS i 
          JOIN C_APPLICATIONS AS a ON i.application_id = a.applicationid 
          JOIN C_EXTERNAL_JOBS AS e ON e.jobid = a.jobid 
        `;

        if (allpermissions) {
          [rows] = await pool.query(`${baseQuery} WHERE i.orgid = ? AND i.confirm = 1`, [orgid]);
        } else {
          [rows] = await pool.query(`${baseQuery} JOIN C_INTERVIEW_PANELS AS ip ON i.interview_id = ip.interview_id AND i.orgid = ip.orgid WHERE i.orgid = ? AND i.confirm = 1 AND ip.empid = ?`, [orgid, empid]);
        }

        // 2. Fetch Candidate Names (From Central Com360_Meta)
        if (rows.length > 0) {
          const candidateIds = [...new Set(rows.map(r => r.candidate_id))];
          
          if (candidateIds.length > 0) {
            try {
              // ✅ Use metaPool directly to query Com360_Meta
              const [candidates] = await metaPool.query(
                `SELECT cid, first_name, last_name, email FROM C_CANDIDATE WHERE cid IN (?)`,
                [candidateIds]
              );

              interviewdetails = rows.map(row => {
                const candidate = candidates.find(c => String(c.cid) === String(row.candidate_id));
                return {
                  ...row,
                  first_name: candidate ? candidate.first_name : 'Unknown',
                  last_name: candidate ? candidate.last_name : '',
                  email: candidate ? candidate.email : ''
                };
              });
            } catch (err) {
              console.error('Error fetching candidates from Meta:', err.message);
              interviewdetails = rows;
            }
          } else {
            interviewdetails = rows;
          }
        }

        // Fetch Config Data
        [time] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 15 AND orgid = ? AND isactive = 1', [orgid]);
        [acceptingtime] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 16 AND orgid = ? AND isactive = 1', [orgid]);
      }
    }
  } catch (error) {
    console.log('error in jobs-interview', error);
  }

  return (
    <div>
      <Overview orgid={orgid} empid={empid} interviewdetails={interviewdetails} time={time} acceptingtime={acceptingtime} editing={editing} />
    </div>
  );
};

export default page;