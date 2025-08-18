import DBconnection from '@/app/utils/config/db';
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

    // Check database
    const pool = await DBconnection();
    const [application] = await pool.query(
      `SELECT candidate_id, applicationid FROM C_APPLICATIONS WHERE applicationid = ?`,
      [applicationId]
    );

    if (application.length === 0) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    const dbCandidateId = application[0].candidate_id;
    if (candidate_id.toString() !== dbCandidateId.toString()) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    return Response.json({ success: true, candidate_id, applicationId });

  } catch (error) {
    console.error('Database error while checking application:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}