import { getAllExternalJobs, getPoolForDatabase } from '@/app/utils/config/jobsdb';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    // Extract JWT from 'job_jwt_token' cookie using request.cookies
    const token = request.cookies.get('job_jwt_token')?.value;
    console.log('job_jwt_token:', token ? 'Present' : 'Missing'); 

    if (!token) {
      return Response.json({ error: 'Unauthorized: Missing job_jwt_token' }, { status: 401 });
    }

    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET); 
      candidate_id = decoded.cid;
      console.log('Decoded candidate_id:', candidate_id); 
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return Response.json({ error: 'Unauthorized: Invalid job_jwt_token' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const uniqueId = formData.get('jobid'); // uniqueId format: databaseName_jobid
    const resume = formData.get('resume');
    const salary_expected = formData.get('salary_expected');

    console.log('Form data - uniqueId:', uniqueId, 'resume:', resume ? 'Present' : 'Missing', 'salary_expected:', salary_expected);

    if (!uniqueId || !resume || !salary_expected) {
      return Response.json({ error: 'Missing jobid, resume, or salary_expected' }, { status: 400 });
    }

    if (isNaN(salary_expected) || salary_expected <= 0) {
      return Response.json({ error: 'Invalid salary_expected value' }, { status: 400 });
    }

    // Parse uniqueId format: databaseName_jobid
    const lastUnderscoreIndex = uniqueId.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
      return Response.json({ error: 'Invalid job identifier format' }, { status: 400 });
    }
    const databaseName = uniqueId.substring(0, lastUnderscoreIndex);
    
    // ✅ FIX: Removed parseInt() to support IDs like "39-1"
    const jobid = uniqueId.substring(lastUnderscoreIndex + 1);

    console.log('Parsed databaseName:', databaseName, 'jobid:', jobid);

    // Find the job in the cache to verify it exists and get orgid
    const { jobs } = await getAllExternalJobs();
    
    // ✅ FIX: Compare jobid as Strings
    const job = jobs.find(j => j._databaseName === databaseName && String(j.jobid) === String(jobid));
    
    if (!job) {
      return Response.json({ error: 'Job not found or inactive' }, { status: 404 });
    }

    // ============================================================
    // DATE VALIDATION LOGIC
    // ============================================================
    const today = new Date().toISOString().split('T')[0];
    
    let jobLastDate = job.lastdate_for_application;
    if (jobLastDate instanceof Date) {
        jobLastDate = jobLastDate.toISOString().split('T')[0];
    }
    
    if (!jobLastDate || jobLastDate < today) {
        console.log(`Application rejected: Job expired. Last Date: ${jobLastDate}, Today: ${today}`);
        return Response.json({ error: 'This job is no longer accepting applications' }, { status: 400 });
    }
    // ============================================================

    const { orgid } = job;
    console.log(`Job ${jobid} belongs to database: ${databaseName}, orgid: ${orgid}`);

    // Get pool for the correct database
    const pool = await getPoolForDatabase(databaseName);

    // Check if the candidate has already applied for this job
    const [existingApplication] = await pool.query(
      `SELECT applicationid FROM C_APPLICATIONS WHERE jobid = ? AND candidate_id = ?`,
      [jobid, candidate_id]
    );
    console.log('Existing application:', existingApplication);

    if (existingApplication.length > 0) {
      return Response.json({ error: 'You have already applied for this job' }, { status: 400 });
    }

    // Generate applicationid as (orgid-no of applications+1)
    const [applicationCount] = await pool.query(
      `SELECT COUNT(*) as count FROM C_APPLICATIONS WHERE jobid IN (
        SELECT jobid FROM C_EXTERNAL_JOBS WHERE orgid = ?
      )`,
      [orgid]
    );
    const applicationNumber = applicationCount[0].count + 1;
    const applicationid = `${orgid}-${applicationNumber}`;
    console.log('Generated applicationid:', applicationid);

    // Fetch application status
    const [statusGid] = await pool.query(
      `SELECT g_id FROM C_GENERIC_NAMES WHERE Name = 'application_status' AND active = 1`
    );

    let applicationStatus = 'applied'; // Default status
    if (statusGid.length > 0) {
      const [statusValue] = await pool.query(
        `SELECT Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1 AND cutting = 1`,
        [statusGid[0].g_id, orgid]
      );

      if (statusValue.length > 0) {
        applicationStatus = statusValue[0].Name;
      }
    }
    console.log('Using application status:', applicationStatus);

    // Ensure the uploads/resumes directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resumes');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
      return Response.json({ error: 'Failed to create upload directory' }, { status: 500 });
    }

    // Save the resume file
    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
    
    const resumePath = `/uploads/resumes/${applicationid}_${formattedDate}.pdf`;
    const filePath = path.join(process.cwd(), 'public', resumePath);
    const buffer = Buffer.from(await resume.arrayBuffer());
    
    try {
      await writeFile(filePath, buffer);
      console.log('Resume saved to:', filePath);
    } catch (error) {
      console.error('Error saving resume:', error);
      return Response.json({ error: 'Failed to save resume file' }, { status: 500 });
    }

    // Insert application into the respective company's database
    console.log(`Inserting application into database: ${databaseName} for orgid: ${orgid}`);
    await pool.query(
      `INSERT INTO C_APPLICATIONS (applicationid, orgid, jobid, applieddate, status, resumepath, candidate_id, salary_expected)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [applicationid, orgid, jobid, applicationStatus, resumePath, candidate_id, salary_expected]
    );

    console.log(`Application ${applicationid} successfully inserted into ${databaseName}.C_APPLICATIONS`);
    return Response.json({ success: true, databaseName, applicationid });
  } catch (error) {
    console.error('Error submitting application:', error);
    return Response.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}