import React from 'react';
import DBconnection from '@/app/utils/config/db';
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
  let applieddetails = [];
  let empid = null;
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
        [applieddetails] = await pool.query(
          'SELECT a.applicationid, a.applieddate, a.jobid, o.display_job_name, a.status, a.candidate_id, c.first_name, c.last_name, a.resumepath FROM C_APPLICATIONS a LEFT JOIN C_EXTERNAL_JOBS o ON a.jobid = o.jobid AND a.orgid = o.orgid LEFT JOIN C_CANDIDATE c ON a.candidate_id = c.cid WHERE a.orgid = ? AND status = ?',
          [orgid, 'applied']
        );

        [scheduledetails] = await pool.query(
          'SELECT a.applicationid, a.applieddate, a.jobid, o.display_job_name, a.status, a.candidate_id, c.first_name, c.last_name, a.resumepath FROM C_APPLICATIONS a LEFT JOIN C_EXTERNAL_JOBS o ON a.jobid = o.jobid AND a.orgid = o.orgid LEFT JOIN C_CANDIDATE c ON a.candidate_id = c.cid WHERE a.orgid = ? AND status != ?',
          [orgid, 'applied']
        );
        [time] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 15 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        console.log(applieddetails);
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  return (
    <div>
      <Overview
        scheduledetails={scheduledetails.map(detail => ({
          ...detail,
          applieddate: formatDate(detail.applieddate)
        }))}
        applieddetails={applieddetails}
        orgid={orgid}
        empid={empid}
        time={time}
      />
    </div>
  );
};

export default page;