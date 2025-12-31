// import { getAllExternalJobs, getPoolForDatabase, getCandidateApplications } from '@/app/utils/config/jobsdb';
// import { verify } from 'jsonwebtoken';

// export async function GET(request, { params }) {
//   try {
//     const { jobid: uniqueId } = params;

//     console.log('Fetching job details for uniqueId:', uniqueId);

//     // Parse uniqueId format: databaseName_jobid
//     const lastUnderscoreIndex = uniqueId.lastIndexOf('_');
//     if (lastUnderscoreIndex === -1) {
//       return Response.json({ error: 'Invalid job identifier format' }, { status: 400 });
//     }
//     const databaseName = uniqueId.substring(0, lastUnderscoreIndex);
    
//     // ✅ FIX: Removed parseInt() to support IDs like "39-1"
//     const jobid = uniqueId.substring(lastUnderscoreIndex + 1);

//     console.log('Parsed databaseName:', databaseName, 'jobid:', jobid);

//     const token = request.cookies.get('job_jwt_token')?.value;
//     console.log('job_jwt_token:', token ? 'Present' : 'Missing');

//     if (!token) {
//       return Response.json({ error: 'Unauthorized: Missing job_jwt_token' }, { status: 401 });
//     }

//     let candidate_id;
//     try {
//       const decoded = verify(token, process.env.JWT_SECRET);
//       candidate_id = decoded.cid;
//       console.log('Decoded candidate_id:', candidate_id);
//     } catch (error) {
//       console.error('JWT verification error:', error.message);
//       return Response.json({ error: 'Unauthorized: Invalid job_jwt_token' }, { status: 401 });
//     }

//     // Get job from cache - match by both databaseName and jobid
//     const { jobs } = await getAllExternalJobs();
    
//     // ✅ FIX: Compare jobid as Strings
//     const job = jobs.find(j => j._databaseName === databaseName && String(j.jobid) === String(jobid));

//     if (!job) {
//       console.log('Job not found for databaseName:', databaseName, 'jobid:', jobid);
//       return Response.json({ error: 'Job not found' }, { status: 404 });
//     }

//     // Check if candidate has applied for this specific job (by uniqueId)
//     const applications = await getCandidateApplications(candidate_id);
    
//     // ✅ FIX: Compare jobid as Strings
//     const hasApplied = applications.some(app => 
//       app._databaseName === databaseName && String(app.jobid) === String(jobid)
//     );

//     // Remove internal database reference before returning, but include uniqueId
//     const { _databaseName, ...jobDetails } = job;

//     return Response.json({
//       job: { ...jobDetails, uniqueId, databaseName },
//       hasApplied
//     });
//   } catch (error) {
//     console.error('Error fetching job details:', error);
//     return Response.json({ error: 'Failed to fetch job details' }, { status: 500 });
//   }
// }

import { getAllExternalJobs, getCandidateApplications } from '@/app/utils/config/jobsdb';
import { verify } from 'jsonwebtoken';

export async function GET(request, { params }) {
  try {
    const { jobid: uniqueId } = params;

    console.log('Fetching job details for uniqueId:', uniqueId);

    // 1. Parse Unique ID
    const lastUnderscoreIndex = uniqueId.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
      return Response.json({ error: 'Invalid job identifier format' }, { status: 400 });
    }
    const databaseName = uniqueId.substring(0, lastUnderscoreIndex);
    
    // ✅ FIX: Keep as String
    const jobid = uniqueId.substring(lastUnderscoreIndex + 1);

    console.log('Parsed databaseName:', databaseName, 'jobid:', jobid);

    const token = request.cookies.get('job_jwt_token')?.value;
    if (!token) {
      return Response.json({ error: 'Unauthorized: Missing job_jwt_token' }, { status: 401 });
    }

    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET);
      candidate_id = decoded.cid;
    } catch (error) {
      return Response.json({ error: 'Unauthorized: Invalid job_jwt_token' }, { status: 401 });
    }

    // 2. Get Job from Cache
    const { jobs } = await getAllExternalJobs();
    
    // ✅ FIX: String comparison
    const job = jobs.find(j => j._databaseName === databaseName && String(j.jobid) === String(jobid));

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // 3. Check if Applied
    const applications = await getCandidateApplications(candidate_id);
    
    // ✅ FIX: String comparison
    const hasApplied = applications.some(app => 
      app._databaseName === databaseName && String(app.jobid) === String(jobid)
    );

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