import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import { getAllroles } from '@/app/serverActions/getAllroles';
import Overview from '@/app/components/Jobs/ExternalJobs/Overview';
import React from 'react'



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



 export default async function page (){
    let orgid=null;
    let expectedjobtitles=[];
    let empid=null;
    let expectedrole=[];
    let expectedepartment=[];
    let countries=[];
    let states=[];
    let jobtype=[];
    let external=[];

    try {
        const pool=await DBconnection();
        const cookieStore=cookies();
        const token=cookieStore.get('jwt_token')?.value;
        if(token){
            const decoded=decodeJwt(token);
            if(decoded&&decoded.orgid&&decoded.empid){
                orgid=decoded.orgid;
                empid=decoded.empid;
                
                [expectedjobtitles]=await pool.query(
                'SELECT job_title_id,job_title, level, min_salary, max_salary FROM C_ORG_JOBTITLES WHERE orgid = ? and is_active=1',
                [orgid]
                );
                [countries] = await pool.query(
                'SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1'
                );
                [states] = await pool.query(
                'SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1'
                );
                const { success, roles: fetchedRoles, error: fetchError } = await getAllroles();
                if (!success) {
                console.error('Failed to fetch roles:', fetchError);
                }
                expectedrole=fetchedRoles;

                [expectedepartment] = await pool.query(
                'SELECT id, name FROM C_ORG_DEPARTMENTS WHERE orgid = ? AND isactive = 1',
                [orgid]
                );

                [jobtype] = await pool.query(
                'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 14 AND orgid = ? AND isactive = 1',
                [orgid]
                );
                [external]=await pool.query(
                  'select jobid,display_job_name,	no_of_vacancies,active from C_EXTERNAL_JOBS where orgid=?',
                  [orgid]
                )
            }
        }

    } catch (error) {
      console.log(error)
        
    }
  
  return (
   <Overview
   orgid={orgid}
   empid={empid}
   expectedjobtitles={expectedjobtitles}
   expectedepartment={expectedepartment}
   expectedrole={expectedrole}
   countries={countries}
   states={states}
   jobtype={jobtype}
   external={external}/>
  )
}

