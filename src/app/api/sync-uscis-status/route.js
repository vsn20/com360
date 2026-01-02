import { NextResponse } from 'next/server';
import DBconnection from '@/app/utils/config/db';

// ✅ OPTIMIZATION: Updated Mapping (Case Approved = 7)
const STATUS_MAPPING = {
  "Case Approved": 7,          
  "Case Was Received": 8,
  "Case Rejected": 9,
  "Request for Evidence": 10,
  "Pending": 11
};

const DEFAULT_STATUS_ID = 0; 

// ---------------------------------------------------------
// HELPER: TOKEN CACHING (Prevents USCIS Rate Limiting)
// ---------------------------------------------------------
if (!globalThis.uscisTokenCache) {
  globalThis.uscisTokenCache = { token: null, expiresAt: 0 };
}

async function getUSCISToken(config) {
  const now = Date.now();
  // Return cached token if valid (buffer of 60 seconds)
  if (globalThis.uscisTokenCache.token && globalThis.uscisTokenCache.expiresAt > now) {
    return globalThis.uscisTokenCache.token;
  }

  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to get USCIS Token");
  
  const tokenData = await tokenRes.json();
  
  // Cache the token
  globalThis.uscisTokenCache.token = tokenData.access_token;
  // Expires in is usually seconds; convert to ms and subtract buffer
  globalThis.uscisTokenCache.expiresAt = now + ((tokenData.expires_in || 3600) * 1000) - 60000;

  return tokenData.access_token;
}

// ---------------------------------------------------------
// HELPER: DATE EXTRACTION
// ---------------------------------------------------------
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
    // Optimization: Skip API call if DB already says "Approved" (7)
    const [existingRows] = await pool.query(
      "SELECT immigration_status FROM C_EMP_IMMIGRATION WHERE document_number = ?",
      [receiptNumber]
    );

    if (existingRows.length > 0 && Number(existingRows[0].immigration_status) === STATUS_MAPPING["Case Approved"]) {
      return NextResponse.json({
        success: true,
        skipped: true,
        mappedId: STATUS_MAPPING["Case Approved"],
        message: `Sync Skipped: Case ${receiptNumber} is already Approved.`
      });
    }

    // ---------------------------------------------------------
    // STEP 2: FETCH FROM USCIS
    // ---------------------------------------------------------
    const CONFIG = {
      tokenUrl: process.env.USCIS_TOKEN_URL || 'https://api-int.uscis.gov/oauth/accesstoken',
      caseUrl: process.env.USCIS_API_BASE || 'https://api-int.uscis.gov/case-status',
      clientId: process.env.USCIS_CLIENT_ID || 'Mpb9ZSthywyVLlPqMJXw7lVrSgyrKlAV',
      clientSecret: process.env.USCIS_CLIENT_SECRET || 'jPhOQufv3kYARWpi',
    };

    const accessToken = await getUSCISToken(CONFIG);

    const caseRes = await fetch(`${CONFIG.caseUrl}/${receiptNumber}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
    });

    if (!caseRes.ok) throw new Error(`USCIS API Error: ${caseRes.statusText}`);
    const caseData = await caseRes.json();

    // ---------------------------------------------------------
    // STEP 3: PARSE DATA
    // ---------------------------------------------------------
    const details = caseData.case_status || caseData;
    const apiStatusText = details.current_case_status_text_en || details.status || "Unknown";
    const apiDescription = details.current_case_status_desc_en || "";

    let statusId = DEFAULT_STATUS_ID;
    const lowerStatus = apiStatusText.toLowerCase();

    // Logic to map text to ID
    if (lowerStatus.includes("approved")) {
        statusId = STATUS_MAPPING["Case Approved"];
    } else if (lowerStatus.includes("received") || lowerStatus.includes("submitted") || lowerStatus.includes("fingerprint")) {
        statusId = STATUS_MAPPING["Case Was Received"];
    } else if (lowerStatus.includes("evidence")) {
        statusId = STATUS_MAPPING["Request for Evidence"];
    } else if (lowerStatus.includes("rejected") || lowerStatus.includes("denied")) {
        statusId = STATUS_MAPPING["Case Rejected"];
    } else if (lowerStatus.includes("pending")) {
        statusId = STATUS_MAPPING["Pending"];
    }

    const extractedDate = extractDateFromDescription(apiDescription);

    // ---------------------------------------------------------
    // STEP 4: UPDATE DATABASE
    // ---------------------------------------------------------
    let updateQuery = `
      UPDATE C_EMP_IMMIGRATION 
      SET 
        immigration_status = ?,       
        uscis_api_status_text = ?,    
        last_updated_uscis = NOW()
    `;

    const queryParams = [statusId, apiStatusText];

    if (extractedDate) {
      updateQuery += `, issue_date = ?`;
      queryParams.push(extractedDate);
    }

    updateQuery += ` WHERE document_number = ?`;
    queryParams.push(receiptNumber);

    await pool.query(updateQuery, queryParams);

    return NextResponse.json({
      success: true,
      mappedId: statusId,
      statusText: apiStatusText,
      extractedDate: extractedDate,
      message: `Updated status to ID ${statusId} (${apiStatusText})`
    });

  } catch (error) {
    console.error("USCIS Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}