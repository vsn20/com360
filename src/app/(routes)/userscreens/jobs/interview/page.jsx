import React from 'react';
import Overview from '@/app/components/Jobs/Interview/Overview';
import DBconnection from '@/app/utils/config/db';
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
  let interview_completed_details = [];
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
          `SELECT roleid FROM emp_role_assign WHERE empid = ? AND orgid = ?`,
          [empid, orgid]
        );
        const roleids = features.map((details) => details.roleid);
        let menuresults = [];
        if (roleids.length > 0) {
          [menuresults] = await pool.query(
            `SELECT alldata FROM role_menu_permissions WHERE roleid IN (?) AND menuid = 12 AND submenuid = 17 AND alldata = 1`,
            [roleids]
          );
        }

        const allpermissions = menuresults.length > 0;
        editing = allpermissions ? 1 : 0;

        if (allpermissions) {
          [interviewdetails] = await pool.query(
            'SELECT i.interview_id, i.application_id, a.jobid, a.status, a.applicationid, c.first_name, c.last_name, e.display_job_name FROM interview_table AS i JOIN applications AS a ON i.application_id = a.applicationid JOIN candidate AS c ON c.cid = a.candidate_id JOIN externaljobs AS e ON e.jobid = a.jobid WHERE i.orgid = ? AND i.confirm = 1',
            [orgid]
          );
        } else {
          [interviewdetails] = await pool.query(
            'SELECT i.interview_id, i.application_id, a.jobid, a.status, a.applicationid, c.first_name, c.last_name, e.display_job_name FROM interview_table AS i JOIN applications AS a ON i.application_id = a.applicationid JOIN candidate AS c ON c.cid = a.candidate_id JOIN externaljobs AS e ON e.jobid = a.jobid JOIN interview_panel AS ip ON i.interview_id = ip.interview_id AND i.orgid = ip.orgid WHERE i.orgid = ? AND i.confirm = 1 AND ip.empid = ?',
            [orgid, empid]
          );
        }

        [time] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 15 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        [acceptingtime] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 16 AND orgid = ? AND isactive = 1',
          [orgid]
        );
      }
    }
  } catch (error) {
    console.log('error in jobs-interview', error);
  }

  return (
    <div>
      <Overview
        orgid={orgid}
        empid={empid}
        interviewdetails={interviewdetails}
        time={time}
        acceptingtime={acceptingtime}
        editing={editing}
      />
    </div>
  );
};

export default page;