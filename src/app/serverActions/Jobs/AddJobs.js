// app/serverActions/Jobs/AddJobs.js
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


export async function addjobtitle(formData) {
  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
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

      const orgId = decoded.orgid;
      const userId = decoded.userId;

      const jobtitle = formData.get('jobtitle')?.trim();
      let minsalary = formData.get('minsalary')?.trim();
      let maxsalary = formData.get('maxsalary')?.trim();
      const level = formData.get('level')?.trim() || null;
      const status = formData.get('status')?.trim();

      if (!jobtitle) {
        console.log('Job title is required');
        return { error: 'Job title is required.' };
      }

      minsalary = minsalary ? parseFloat(minsalary) : null;
      maxsalary = maxsalary ? parseFloat(maxsalary) : null;

      if (minsalary && maxsalary && maxsalary < minsalary) {
        console.log('Maximum salary less than minimum salary');
        return { error: 'Maximum salary cannot be less than minimum salary.' };
      }

      pool = await DBconnection();

      const [counts] = await pool.query('SELECT COUNT(*) as count FROM org_jobtitles WHERE orgid = ?', [orgId]);
      const updatedCount = counts[0].count;
      const jobid = `${orgId}-${updatedCount + 1}`;

      const isActive = status === 'Active' ? 1 : 0;
      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgId);

      await pool.query(
        `INSERT INTO org_jobtitles (job_title_id, job_title, min_salary, max_salary, level, orgid, is_active, Createdby, CreatedDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`,
        [jobid, jobtitle, minsalary, maxsalary, level, orgId, isActive, createdBy,new Date()]
      );

      console.log(`Job title added with job_title_id: ${jobid}`);
      return { success: true };
    } catch (error) {
      console.error('Error adding job title:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to add job title: ${error.message}` };
    }
  }
  return { error: 'Failed to add job title after multiple retries: Pool is closed' };
}