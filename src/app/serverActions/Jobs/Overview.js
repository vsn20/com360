// app/serverActions/Jobs/Overview.js
'use server';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const decodeJwt = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
};

const getdisplayprojectid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
    }
    let empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    empid=getdisplayprojectid(empid);
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function getjobdetailsbyid(jobid) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    if (!jobid) {
      console.log('jobid is missing');
      throw new Error('Job ID is required.');
    }

    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT job_title_id, job_title, level, min_salary, max_salary, Createdby, orgid, is_active, CreatedDate, Updatedby, UpdatedDate FROM org_jobtitles WHERE job_title_id = ? AND orgid = ?',
      [jobid, orgId]
    );

    if (rows.length === 0) {
      console.log('No job title found for job_title_id:', jobid);
      throw new Error('No job title found for the given job ID.');
    }

    console.log('Fetched job title:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error fetching job title:', error.message);
    throw new Error(`Failed to fetch job title: ${error.message}`);
  }
}




const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      // Use local date components to preserve YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      // If it's already a date string (YYYY-MM-DD), return it as is
      return date.split('T')[0];
    }
    return ''; // Fallback for invalid dates
  };




export async function updatejobtitle(formData) {
  try {
    const jobid = formData.get('jobid');
    const orgId = formData.get('org_id');
    const jobtitle = formData.get('jobtitle')?.trim();
    let minsalary = formData.get('minsalary')?.trim();
    let maxsalary = formData.get('maxsalary')?.trim();
    const level = formData.get('level')?.trim() || null;
    const status = formData.get('status')?.trim();

    if (!jobid) {
      console.log('Job ID is missing');
      return { error: 'Job ID is required.' };
    }

    if (!orgId) {
      console.log('Organization ID is missing');
      return { error: 'Organization ID is required.' };
    }

    if (!jobtitle) {
      console.log('Job title is missing');
      return { error: 'Job title is required.' };
    }

    minsalary = minsalary ? parseFloat(minsalary) : null;
    maxsalary = maxsalary ? parseFloat(maxsalary) : null;

    if (minsalary && maxsalary && maxsalary < minsalary) {
      console.log('Maximum salary less than minimum salary');
      return { error: 'Maximum salary cannot be less than minimum salary.' };
    }

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) {
      console.log('Invalid token or orgid/userId not found');
      return { error: 'Invalid token or orgid/userId not found.' };
    }

    if (String(orgId) !== String(decoded.orgid)) {
      console.log(`Mismatched orgid. FormData orgid: ${orgId}, JWT orgid: ${decoded.orgid}`);
      return { error: 'Organization ID mismatch.' };
    }

    const pool = await DBconnection();
    const [existing] = await pool.execute(
      'SELECT job_title_id FROM org_jobtitles WHERE job_title_id = ? AND orgid = ?',
      [jobid, orgId]
    );

    if (existing.length === 0) {
      console.log('Job title not found');
      return { error: 'Job title not found.' };
    }

    const isActive = status === 'Active' ? 1 : 0;
    
    const [rows]=await pool.query(
      `select count(*) as count from C_EMP where JOB_TITLE=?`,
      [jobid]
    );

    if(rows[0].count>0&&!isActive){
      return {error:`Employees Exists Under This JOB TITLE`}
    }

    const updatedBy = await getCurrentUserEmpIdName(pool, decoded.userId, orgId);
    
    const [result] = await pool.query(
      `UPDATE org_jobtitles 
       SET job_title = ?, min_salary = ?, max_salary = ?, level = ?, is_active = ?, Updatedby = ?, UpdatedDate =?
       WHERE job_title_id = ? AND orgid = ?`,
      [jobtitle, minsalary, maxsalary, level, isActive, updatedBy,new Date() ,jobid, orgId]
    );

    if (result.affectedRows === 0) {
      console.log('No rows updated for job_title_id:', jobid);
      return { error: 'No changes were applied.' };
    }

    console.log(`Job title updated: job_title_id ${jobid}, affectedRows: ${result.affectedRows}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating job title:', error.message);
    return { error: `Failed to update job title: ${error.message}` };
  }
}