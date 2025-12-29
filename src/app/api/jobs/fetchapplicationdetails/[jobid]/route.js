import { getAllExternalJobs, getPoolForDatabase, getCandidateApplications } from '@/app/utils/config/jobsdb';
import { verify } from 'jsonwebtoken';

export async function GET(request, { params }) {
  try {
    const { jobid: uniqueId } = params;

    console.log('Fetching job details for uniqueId:', uniqueId);

    // Parse uniqueId format: databaseName_jobid
    const lastUnderscoreIndex = uniqueId.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
      return Response.json({ error: 'Invalid job identifier format' }, { status: 400 });
    }
    const databaseName = uniqueId.substring(0, lastUnderscoreIndex);
    const jobid = parseInt(uniqueId.substring(lastUnderscoreIndex + 1));

    console.log('Parsed databaseName:', databaseName, 'jobid:', jobid);

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

    // Get job from cache - match by both databaseName and jobid
    const { jobs } = await getAllExternalJobs();
    const job = jobs.find(j => j._databaseName === databaseName && j.jobid === jobid);

    if (!job) {
      console.log('Job not found for databaseName:', databaseName, 'jobid:', jobid);
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if candidate has applied for this specific job (by uniqueId)
    const applications = await getCandidateApplications(candidate_id);
    const hasApplied = applications.some(app => 
      app._databaseName === databaseName && app.jobid === jobid
    );

    // Remove internal database reference before returning, but include uniqueId
    const { _databaseName, ...jobDetails } = job;

    return Response.json({
      job: { ...jobDetails, uniqueId, databaseName },
      hasApplied
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    return Response.json({ error: 'Failed to fetch job details' }, { status: 500 });
  }
}