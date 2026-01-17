'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import { getW4FormDetails, generateW4PDF, uploadPDFToDocuments } from './w4form/action';

// --- DATE UTILITIES (MATCHING I-983 LOGIC) ---

// ✅ FIXED: Date formatting utility to prevent day-before issue (String logic only)
const formatDate = (date) => {
    if (!date) return null;

    // If it's already a YYYY-MM-DD string, trust it and return it
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
    }

    // If it's a full ISO string (e.g. 2026-02-20T...), split it
    if (typeof date === 'string' && date.includes('T')) {
        return date.split('T')[0];
    }
    
    // Fallback for Date objects (use local time components)
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        if (year < 1900 || year > 2100) return null;
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn("Error formatting date for DB:", e);
        return null;
    }
};

// Helper to decode JWT
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

// Form W-4 does not require a verifier signature, only data entry.
export async function verifyW4Form({ formId: prefixedFormId, verifierId, orgId, employerData }) {
  try {
    const formId = parseInt(String(prefixedFormId).replace('W4-', ''));
    if (isNaN(formId)) {
        throw new Error('Invalid Form ID format.');
    }

    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) throw new Error('Authentication failed.');

    // ✅ FIXED: Use formatDate() for consistent date handling
    const formattedEmploymentDate = formatDate(employerData.first_date_of_employment);
    
    // Update the form with employer data and set status to VERIFIED
    await pool.query(
      `UPDATE C_FORM_W4 SET 
         FORM_STATUS = 'VERIFIED',
         VERIFIER_ID = ?,
         VERIFIED_AT = NOW(),
         EMPLOYER_NAME_ADDRESS = ?,
         FIRST_DATE_OF_EMPLOYMENT = ?,
         EMPLOYER_EIN = ?
       WHERE ID = ?`,
      [
        verifierId,
        employerData.employer_name_address,
        formattedEmploymentDate,
        employerData.employer_ein,
        formId
      ]
    );

    // Get the fully updated W-4 data
    const w4Data = await getW4FormDetails(formId);
    if (!w4Data) throw new Error('W-4 form not found after update.');

    // Regenerate the PDF, this time with the employer data included
    const pdfResult = await generateW4PDF(w4Data);

    if (!pdfResult.success) {
        throw new Error(pdfResult.error);
    }
    
    // Upload the final, verified PDF, overwriting the "Submitted" one
    const uploadResult = await uploadPDFToDocuments(
        pdfResult.pdfBytes, 
        w4Data.EMP_ID, 
        orgId, 
        formId, 
        decoded.userId, 
        'Verified' // Set status to 'Verified'
    );
    
    if (!uploadResult.success) {
        throw new Error(uploadResult.error);
    }

    return { success: true, message: 'W-4 Form successfully verified and document saved.' };
  } catch (error) {
    console.error('Error in verifyW4Form action:', error);
    return { success: false, error: error.message };
  }
}