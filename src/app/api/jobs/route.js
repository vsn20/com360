import { getAllExternalJobs, getCandidateApplications } from '@/app/utils/config/jobsdb';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('job_jwt_token')?.value;

    let appliedJobs = [];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Get all applied jobs for this candidate across all databases
        const applications = await getCandidateApplications(decoded.cid);
        // Create uniqueId for applied jobs (databaseName_jobid)
        appliedJobs = applications.map((app) => `${app._databaseName}_${app.jobid}`);
      } catch (jwtError) {
        console.warn('JWT verification failed:', jwtError.message);
      }
    }

    // Get all external jobs from all subscriber databases (cached for 5 minutes)
    const { jobs, orgs, fromCache, lastUpdated } = await getAllExternalJobs();

    // Add unique identifier and keep database reference for proper job identification
    const sanitizedJobs = jobs.map(({ _databaseName, ...job }) => ({
      ...job,
      // Create unique key combining database and jobid (needed since jobid can repeat across databases)
      uniqueId: `${_databaseName}_${job.jobid}`,
      databaseName: _databaseName
    }));
    const sanitizedOrgs = orgs.map(({ _databaseName, ...org }) => org);

    // Deduplicate orgs by orgid (in case same org exists in multiple databases)
    const uniqueOrgs = [];
    const seenOrgIds = new Set();
    for (const org of sanitizedOrgs) {
      if (!seenOrgIds.has(org.orgid)) {
        seenOrgIds.add(org.orgid);
        uniqueOrgs.push(org);
      }
    }

    return Response.json({ 
      orgs: uniqueOrgs, 
      jobs: sanitizedJobs, 
      appliedJobs,
      meta: {
        fromCache,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
        totalJobs: sanitizedJobs.length
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}