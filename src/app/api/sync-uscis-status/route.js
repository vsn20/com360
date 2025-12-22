import { NextResponse } from 'next/server';
import DBconnection from '@/app/utils/config/db';

// !!! IMPORTANT: UPDATE THIS MAPPING TO MATCH YOUR "IMMIGRATION STATUS" GENERIC VALUES !!!
const STATUS_MAPPING = {
  "Case Approved": 7,         
  "Case Was Received": 8,     
  "Case Rejected": 9,         
  "Request for Evidence": 10,  
  "Pending": 11               
};

const DEFAULT_STATUS_ID = 0; 

// Helper: Extract date from text using LOCAL time to avoid timezone shifts
function extractDateFromDescription(text) {
  if (!text) return null;
  
  // Regex looks for "On Month DD, YYYY"
  const dateRegex = /On\s([A-MM-z]+\s\d{1,2},\s\d{4})/;
  const match = text.match(dateRegex);
  
  if (match && match[1]) {
    const d = new Date(match[1]);
    if (!isNaN(d)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

export async function POST(req) {
  try {
    const { receiptNumber } = await req.json();

    if (!receiptNumber) {
      return NextResponse.json({ message: 'Receipt Number is required' }, { status: 400 });
    }

    const pool = await DBconnection();

    // ---------------------------------------------------------
    // STEP 1: CHECK IF ALREADY APPROVED
    // ---------------------------------------------------------
    const [existingRows] = await pool.execute(
      "SELECT immigration_status FROM C_EMP_IMMIGRATION WHERE document_number = ?",
      [receiptNumber]
    );

    // If the record exists and status is already 'Case Approved' (582), stop here.
    // if (existingRows.length > 0 && existingRows[0].immigration_status === STATUS_MAPPING["Case Approved"]) {
    //   return NextResponse.json({
    //     success: true,
    //     skipped: true,
    //     message: `Sync Skipped: Case ${receiptNumber} is already Approved.`
    //   });
    // }

    // ---------------------------------------------------------
    // STEP 2: PROCEED WITH SYNC (Only if not approved)
    // ---------------------------------------------------------
    
    // 1. Configuration
    const CONFIG = {
      tokenUrl: process.env.USCIS_TOKEN_URL || 'https://api-int.uscis.gov/oauth/accesstoken',
      caseUrl: process.env.USCIS_API_BASE || 'https://api-int.uscis.gov/case-status',
      clientId: process.env.USCIS_CLIENT_ID || 'Mpb9ZSthywyVLlPqMJXw7lVrSgyrKlAV',
      clientSecret: process.env.USCIS_CLIENT_SECRET || 'jPhOQufv3kYARWpi',
    };

    // 2. Get Access Token
    const tokenRes = await fetch(CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret,
      }),
    });

    if (!tokenRes.ok) throw new Error("Failed to get USCIS Token");
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 3. Fetch Case Status from USCIS
    const caseRes = await fetch(`${CONFIG.caseUrl}/${receiptNumber}`, {
      headers: { 
        Authorization: `Bearer ${accessToken}`, 
        Accept: 'application/json' 
      },
    });

    if (!caseRes.ok) throw new Error("Failed to fetch Case Status from USCIS");
    const caseData = await caseRes.json();

    // 4. Extract Status Text & Description
    const details = caseData.case_status || caseData;
    const apiStatusText = details.current_case_status_text_en || details.status || "Unknown";
    const apiDescription = details.current_case_status_desc_en || "";

    // 5. Map Text to Integer ID
    let statusId = DEFAULT_STATUS_ID;
    const lowerStatus = apiStatusText.toLowerCase();

    if (lowerStatus.includes("approved")) {
        statusId = STATUS_MAPPING["Case Approved"];
    } else if (lowerStatus.includes("received") || lowerStatus.includes("submitted")) {
        statusId = STATUS_MAPPING["Case Was Received"];
    } else if (lowerStatus.includes("evidence")) {
        statusId = STATUS_MAPPING["Request for Evidence"];
    } else if (lowerStatus.includes("rejected")) {
        statusId = STATUS_MAPPING["Case Rejected"];
    }

    // 6. Extract Date (Approval/Action Date)
    const extractedDate = extractDateFromDescription(apiDescription);

    // 7. Update Database
    let updateQuery = `
      UPDATE C_EMP_IMMIGRATION 
      SET 
        immigration_status = ?,       
        uscis_api_status_text = ?,    
        last_updated_uscis = NOW()
    `;

    const queryParams = [statusId, apiStatusText];

    // Only update issue_date if we successfully found one in the text
    if (extractedDate) {
      updateQuery += `, issue_date = ?`; 
      queryParams.push(extractedDate);
    }

    updateQuery += ` WHERE document_number = ?`;
    queryParams.push(receiptNumber);

    await pool.execute(updateQuery, queryParams);

    return NextResponse.json({
      success: true,
      mappedId: statusId,
      statusText: apiStatusText,
      extractedDate: extractedDate,
      message: `Updated status to ID ${statusId} (${apiStatusText})${extractedDate ? ` and Date to ${extractedDate}` : ''}`
    });

  } catch (error) {
    console.error("USCIS Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}