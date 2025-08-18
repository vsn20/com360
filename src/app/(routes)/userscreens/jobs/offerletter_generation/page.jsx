import React from 'react'
import DBconnection from '@/app/utils/config/db';
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


const page = async() => {
let orgid=null;
let empid=null;
let interviewdetails=[];
let acceptingtime=[];
let offerlettergenerated=[];

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
       'select a.orgid,a.interview_id,a.application_id,b.status,b.candidate_id,c.first_name,c.last_name from C_INTERVIEW_TABLES as a join C_APPLICATIONS as b on a.application_id=b.applicationid join C_CANDIDATE as c on b.candidate_id=c.cid  where a.offer_letter_generated!=1 and   a.orgid=? and a.interview_completed=1 and a.confirm=1',
       [orgid]
        );
         [acceptingtime]=await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 16 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        [offerlettergenerated]=await pool.query(
       'select a.orgid,a.interview_id,a.application_id,b.status,b.candidate_id,c.first_name,c.last_name,z.offerletter_url from C_INTERVIEW_TABLES as a join C_APPLICATIONS as b on a.application_id=b.applicationid join C_CANDIDATE as c on b.candidate_id=c.cid join C_OFFER_LETTERS as z on z.applicationid=b.applicationid where a.offer_letter_generated=1 and a.orgid=? and a.interview_completed=1 and a.confirm=1',
       [orgid]
        );
        console.log("interviews details",interviewdetails);
      }
    }
} catch (error) {
    console.log("error in jobs-offerletter generation page",error);
}
  return (
    <div><Overview
    empid={empid}
    orgid={orgid}
    interviewdetails={interviewdetails}
    acceptingtime={acceptingtime}
    offerlettergenerated={offerlettergenerated}/></div>
  )
}

export default page