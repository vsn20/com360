export const dynamic = 'force-dynamic';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import React from 'react'
import Jobtitle from '@/app/components/Jobs/JobTitle/Jobtitle';
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



export default async function jobtitles() {
    
    let orgid=null;
    let jobtitles=[];
    let empid=null;
    try {
        const pool=await DBconnection();
        const cookieStore=cookies();
        const token=cookieStore.get('jwt_token')?.value;
        if(token){
            const decoded=decodeJwt(token);
            if(decoded&&decoded.orgid&&decoded.empid){
                orgid=decoded.orgid;
                empid=decoded.empid;


                [jobtitles]=await pool.query(
                'SELECT job_title_id,job_title, level, min_salary, max_salary,is_active,CreatedDate FROM C_ORG_JOBTITLES WHERE orgid = ?',
                [orgid]
                );

            }
        }
    } catch (error) {
        console.log("error in jobs-jobtitle",error);
    }

    return(
        <Jobtitle
        orgid={orgid}
        empid={empid}
        jobtitles={jobtitles}
       
        />
    );


}