import React from 'react'
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

const page = async() => {

let orgid=null;
let empid=null;
let interviewdetails=[];
let time=[];
let acceptingtime=[];
let interview_completed_details=[];
try {

  const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;
        empid = decoded.empid;

        [interviewdetails]=await pool.query(
       'select a.interview_id,d.email,a.is_he_employee,b.start_date,b.application_id,b.start_am_pm,b.end_date,b.end_am_pm,b.start_time,b.interview_completed,b.end_time,b.meeting_link,c.applicationid,c.applieddate,c.jobid,c.candidate_id,d.first_name,d.last_name,c.resumepath,e.job_title from interview_panel as a join interview_table as b on a.interview_id=b.interview_id and a.orgid=b.orgid  join applications c on c.applicationid=b.application_id  join candidate d on d.cid=c.candidate_id join org_jobtitles as e on e.job_title_id=c.jobid where a.orgid=? and b.confirm=1 and a.empid=? ',
       [orgid,empid]
        );
         [interview_completed_details]=await pool.query(
       'select a.interview_id,d.email,a.is_he_employee,b.start_date,b.application_id,b.start_am_pm,b.end_date,b.end_am_pm,b.start_time,b.interview_completed,b.end_time,b.meeting_link,c.applicationid,c.applieddate,c.jobid,c.candidate_id,d.first_name,d.last_name,c.resumepath,e.job_title,c.status from interview_panel as a join interview_table as b on a.interview_id=b.interview_id and a.orgid=b.orgid  join applications c on c.applicationid=b.application_id  join candidate d on d.cid=c.candidate_id join org_jobtitles as e on e.job_title_id=c.jobid where a.orgid=? and b.confirm=1 and a.empid=? and b.interview_completed=1 ',
       [orgid,empid]
        );
        console.log("interviews details",interview_completed_details);
        [time] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 15 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        [acceptingtime]=await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 16 AND orgid = ? AND isactive = 1',
          [orgid]
        );

        
      }
    }
  
} catch (error) {
   console.log("error in jobs-interview",error);
}

  return (
    <div><Overview
    orgid={orgid}
    empid={empid}
    interviewdetails={interviewdetails}
    time={time}
    acceptingtime={acceptingtime}
    interview_completed_details={interview_completed_details}
    />
    </div>
  )
}

export default page