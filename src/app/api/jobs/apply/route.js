import DBconnection from '@/app/utils/config/db';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const pool = await DBconnection();

    // Extract JWT from 'job_jwt_token' cookie using request.cookies
    const token = request.cookies.get('job_jwt_token')?.value;
    console.log('job_jwt_token:', token ? 'Present' : 'Missing'); // Debug log

    if (!token) {
      return Response.json({ error: 'Unauthorized: Missing job_jwt_token' }, { status: 401 });
    }

    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET); // Replace with your JWT secret
      candidate_id = decoded.cid;
      console.log('Decoded candidate_id:', candidate_id); // Debug log
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return Response.json({ error: 'Unauthorized: Invalid job_jwt_token' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const jobid = formData.get('jobid');
    const resume = formData.get('resume');
    const salary_expected = formData.get('salary_expected');

    console.log('Form data - jobid:', jobid, 'resume:', resume ? 'Present' : 'Missing', 'salary_expected:', salary_expected); // Debug log

    if (!jobid || !resume || !salary_expected) {
      return Response.json({ error: 'Missing jobid, resume, or salary_expected' }, { status: 400 });
    }

    if (isNaN(salary_expected) || salary_expected <= 0) {
      return Response.json({ error: 'Invalid salary_expected value' }, { status: 400 });
    }

    // Check if the C_CANDIDATE has already applied for this job
    const [existingApplication] = await pool.query(
      `SELECT applicationid FROM C_APPLICATIONS WHERE jobid = ? AND candidate_id = ?`,
      [jobid, candidate_id]
    );
    console.log('Existing application:', existingApplication); // Debug log

    if (existingApplication.length > 0) {
      return Response.json({ error: 'You have already applied for this job' }, { status: 400 });
    }

    // Fetch job details to get orgid
    const [jobDetails] = await pool.query(
      `SELECT orgid FROM C_EXTERNAL_JOBS WHERE jobid = ? AND active = 1`,
      [jobid]
    );
    console.log('Job details:', jobDetails); // Debug log

    if (jobDetails.length === 0) {
      return Response.json({ error: 'Job not found or inactive' }, { status: 404 });
    }

    const { orgid } = jobDetails[0];

    // Generate applicationid as (orgid-no of C_APPLICATIONS+1)
    const [applicationCount] = await pool.query(
      `SELECT COUNT(*) as count FROM C_APPLICATIONS WHERE jobid IN (
        SELECT jobid FROM C_EXTERNAL_JOBS WHERE orgid = ?
      )`,
      [orgid]
    );
    const applicationNumber = applicationCount[0].count + 1;
    const applicationid = `${orgid}-${applicationNumber}`;
    console.log('Generated applicationid:', applicationid); // Debug log

    // Fetch application status from C_GENERIC_NAMES and C_GENERIC_VALUES
    const [statusGid] = await pool.query(
      `SELECT g_id FROM C_GENERIC_NAMES WHERE Name = 'application_status' AND active = 1`
    );
    console.log('Status g_id:', statusGid); // Debug log

    if (statusGid.length === 0) {
      return Response.json({ error: 'Application status not found in C_GENERIC_NAMES' }, { status: 500 });
    }

    const [statusValue] = await pool.query(
      `SELECT Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1 AND cutting = 1`,
      [statusGid[0].g_id, orgid]
    );
    console.log('Status value:', statusValue); // Debug log

    const applicationStatus = statusValue.length > 0 ? statusValue[0].Name : 'applied';
    console.log('Using application status:', applicationStatus); // Debug log

    // Ensure the uploads/resumes directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resumes');
    try {
      await mkdir(uploadDir, { recursive: true });
      console.log('Upload directory ensured:', uploadDir); // Debug log
    } catch (error) {
      console.error('Error creating upload directory:', error);
      return Response.json({ error: 'Failed to create upload directory' }, { status: 500 });
    }

    // Save the resume file with mm-dd-yyyy date format
    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-'); // Convert to mm-dd-yyyy
    const resumePath = `/uploads/resumes/${applicationid}_${formattedDate}.pdf`;
    const filePath = path.join(process.cwd(), 'public', resumePath);
    const buffer = Buffer.from(await resume.arrayBuffer());
    try {
      await writeFile(filePath, buffer);
      console.log('Resume saved to:', filePath); // Debug log
    } catch (error) {
      console.error('Error saving resume:', error);
      return Response.json({ error: 'Failed to save resume file' }, { status: 500 });
    }

    // Insert application into the database
    await pool.query(
      `INSERT INTO C_APPLICATIONS (applicationid, orgid, jobid, applieddate, status, resumepath, candidate_id, salary_expected)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [applicationid, orgid, jobid, applicationStatus, resumePath, candidate_id, salary_expected]
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error submitting application:', error);
    return Response.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}