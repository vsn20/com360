// src/app/api/verify-signature-access/route.js
import { NextResponse } from 'next/server';
import DBconnection from '@/app/utils/config/db';

// Helper function to decode JWT
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

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, formId, orgid, empid } = body;

    if (!token || !formId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Decode and verify token
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get database connection
    const pool = await DBconnection();

    // Check if the form belongs to the user's organization
    const [formRows] = await pool.query(
      `SELECT ID, ORG_ID, EMP_ID FROM C_FORMS WHERE ID = ?`,
      [formId]
    );

    if (formRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Form not found' },
        { status: 404 }
      );
    }

    const form = formRows[0];

    // Verify organization access - user must belong to the same organization
    if (form.ORG_ID.toString() !== decoded.orgid.toString()) {
      console.log(`Signature access denied: User orgid ${decoded.orgid} !== Form orgid ${form.ORG_ID}`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Cannot access signature from another organization' },
        { status: 403 }
      );
    }

    // Access granted - user is from the same organization
    console.log(`Signature access granted for form ${formId} to user ${decoded.empid} from org ${decoded.orgid}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error verifying signature access:', error);
    return NextResponse.json(
      { success: false, error: 'Server error verifying access' },
      { status: 500 }
    );
  }
}
