import { getCandidateApplications } from '@/app/utils/config/jobsdb';
import { verify } from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { applicationId, token } = await request.json();

    if (!applicationId || !token) {
      return Response.json({ error: 'Missing applicationId or token' }, { status: 400 });
    }

    // Verify JWT token
    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET);
      candidate_id = decoded.cid;
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all applications for this candidate across all databases
    const applications = await getCandidateApplications(candidate_id);
    
    // Find the specific application
    const application = applications.find(app => app.applicationid === applicationId);

    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // The candidate owns this application (since we searched by candidate_id)
    return Response.json({ success: true, candidate_id, applicationId });

  } catch (error) {
    console.error('Error while checking application:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}