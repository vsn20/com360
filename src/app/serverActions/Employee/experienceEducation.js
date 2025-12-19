'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ============ HELPER FUNCTIONS ============

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

const formatDateForDB = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Helper to wrap text for PDF generation
const drawParagraph = (page, text, y, width, margin, font, fontSize, lineGap) => {
  const lines = [];
  const maxWidth = width - margin * 2;
  let currentLine = '';
  
  text.split(' ').forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (textWidth < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  lines.push(currentLine);

  let currentY = y;
  lines.forEach(line => {
    page.drawText(line, {
      x: margin,
      y: currentY,
      font: font,
      size: fontSize,
      color: rgb(0, 0, 0),
    });
    currentY -= (fontSize + 6);
  });

  // Return the new Y position
  return currentY - (lineGap - (fontSize + 6)); 
};

// ============ PDF GENERATION FUNCTION ============

export async function generateExperienceLetterPDF(data) {
  try {
    const { 
      employeeName, 
      orgid, 
      orgName,
      jobTitle, 
      startDate, 
      endDate, 
      gender, 
      supervisorName, 
      supervisorEmail,
      superiorRole 
    } = data;

    const cookieStore = cookies();
    const token = cookieStore.get("jwt_token")?.value;
    if (!token) return { success: false, error: 'Authentication required' };

    // Decode token to get current user info for signature lookup
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) return { success: false, error: 'Invalid token' };

    const pool = await DBconnection();

    // Fetch the logged-in user's EMPID to find their signature
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [decoded.userId, orgid]
    );
    
    // Default to the user ID from token if C_USER lookup fails (fallback)
    const signerEmpId = userRows.length > 0 ? userRows[0].empid : decoded.userId; 

    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const fontSize = 11;
    const margin = 50;
    let y = height - margin;

    // 2. Embed Logo
    const logoPath = path.join(process.cwd(), 'public', 'uploads', 'orglogos', `${orgid}.jpg`);
    try {
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath);
        const logoImage = await pdfDoc.embedJpg(logoBytes);
        const logoWidth = 50;
        const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
        page.drawImage(logoImage, { x: margin, y: y - logoHeight, width: logoWidth, height: logoHeight });
        y -= (logoHeight + 30);
      }
    } catch (error) {
      console.error('Error loading logo:', error.message);
    }

    // 3. Prepare Text
    const isFemale = gender && gender.toLowerCase().trim() === 'female';
    const title = isFemale ? 'Ms.' : 'Mr.';
    const hisHer = isFemale ? 'her' : 'his';     
    const himHer = isFemale ? 'her' : 'him';    
    const himselfHerself = isFemale ? 'herself' : 'himself';
    // Get last name safely
    const nameParts = employeeName.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : employeeName;
    const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY format

    // 4. Draw Content
    const drawLine = (text, isBold = false) => {
      page.drawText(text, {
        x: margin,
        y: y,
        font: isBold ? timesRomanBoldFont : timesRomanFont,
        size: fontSize,
        color: rgb(0, 0, 0),
      });
      y -= (fontSize + 8);
    };

    y -= 10;
    drawLine(`Date: ${today}`, true);
    y -= 20;
    drawLine(`To Whom It May Concern,`);
    y -= 20;

    const lineGap = 18;
    
    let text = `This is to certify that ${employeeName} was employed with ${orgName} as a ${jobTitle} from ${startDate} to ${endDate}.`;
    y = drawParagraph(page, text, y, width, margin, timesRomanFont, fontSize, lineGap);

    text = `During ${hisHer} tenure with ${orgName}, ${title} ${lastName} demonstrated strong technical expertise, professionalism, and dedication across multiple cloud and data engineering initiatives.`;
    y = drawParagraph(page, text, y, width, margin, timesRomanFont, fontSize, lineGap);

    text = `Throughout ${hisHer} employment, ${title} ${lastName} conducted ${himselfHerself} with integrity and professionalism. ${title === 'Mr.' ? 'His' : 'Her'} contributions were valuable to the growth and success of our engineering initiatives.`;
    y = drawParagraph(page, text, y, width, margin, timesRomanFont, fontSize, lineGap);

    text = `We thank ${himHer} for ${hisHer} service to ${orgName} and wish ${himHer} continued success in all ${hisHer} future endeavors.`;
    y = drawParagraph(page, text, y, width, margin, timesRomanFont, fontSize, lineGap);

    text = `For any verification or additional information, you may contact us at ${supervisorEmail || 'hr@company.com'}.`;
    y = drawParagraph(page, text, y, width, margin, timesRomanFont, fontSize, lineGap);

    y -= 30;
    drawLine(`Sincerely,`);
    y -= 10;
    drawLine(`${orgName}`, true);
    
    // 5. Embed Signature
    // Path matches your reference: public/Uploads/signatures/
    const signatureJpgPath = path.join(process.cwd(), 'public', 'Uploads', 'signatures', `${signerEmpId}.jpg`);
    
    try {
      if (fs.existsSync(signatureJpgPath)) {
        const signatureBytes = fs.readFileSync(signatureJpgPath);
        const signatureImage = await pdfDoc.embedJpg(signatureBytes);
        const signatureWidth = 50;
        const signatureHeight = (signatureImage.height / signatureImage.width) * signatureWidth;
        
        // Ensure signature doesn't go off page
        if (y - signatureHeight < 20) {
            page.addPage();
            y = height - margin;
        }
        
        page.drawImage(signatureImage, { x: margin, y: y - signatureHeight, width: signatureWidth, height: signatureHeight });
        y -= (signatureHeight + 10);
      } else {
        // Leave space if signature missing
        y -= 40; 
      }
    } catch (error) {
      console.error('Error loading signature:', error.message);
      y -= 40;
    }

    drawLine(`${supervisorName || 'Authorized Signatory'}`);
    drawLine(`${superiorRole || 'Manager'}`);

    const pdfBytes = await pdfDoc.save();
    return { success: true, pdfBase64: Buffer.from(pdfBytes).toString('base64') };

  } catch (error) {
    console.error('Error generating PDF:', error);
    return { success: false, error: 'Failed to generate PDF' };
  }
}

// ============ EDUCATION FUNCTIONS ============

export async function fetchEducationByEmpId(empid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT 
        id,
        employee_id,
        degree_name,
        major,
        institution,
        country,
        state,
        custom_state_name,
        location_city,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        graduated,
        honors,
        transcript_url,
        notes
      FROM C_EMPLOYEE_EDUCATION 
      WHERE employee_id = ? 
      ORDER BY start_date DESC`,
      [empid]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching education:', error);
    throw new Error('Failed to fetch education records');
  }
}

export async function addEducation(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Authentication required' };

    const decoded = decodeJwt(token);
    if (!decoded?.orgid) return { error: 'Invalid token' };

    const pool = await DBconnection();
    
    const employee_id = formData.get('employee_id');
    const degree_name = formData.get('degree_name')?.trim() || null;
    const major = formData.get('major')?.trim() || null;
    const institution = formData.get('institution')?.trim() || null;
    const country = formData.get('country') || null;
    const state = formData.get('state') || null;
    const custom_state_name = formData.get('custom_state_name')?.trim() || null;
    const location_city = formData.get('location_city')?.trim() || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const graduated = formData.get('graduated') === 'true' ? 1 : 0;
    const honors = formData.get('honors')?.trim() || null;
    const transcript_url = formData.get('transcript_url')?.trim() || null;
    const notes = formData.get('notes')?.trim() || null;

    const [result] = await pool.execute(
      `INSERT INTO C_EMPLOYEE_EDUCATION 
       (employee_id, degree_name, major, institution, country, state, custom_state_name, 
        location_city, start_date, end_date, graduated, honors, transcript_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, degree_name, major, institution, country, state, custom_state_name,
       location_city, start_date, end_date, graduated, honors, transcript_url, notes]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Error adding education:', error);
    return { error: 'Failed to add education record' };
  }
}

export async function updateEducation(formData) {
  try {
    const pool = await DBconnection();
    
    const id = formData.get('id');
    const degree_name = formData.get('degree_name')?.trim() || null;
    const major = formData.get('major')?.trim() || null;
    const institution = formData.get('institution')?.trim() || null;
    const country = formData.get('country') || null;
    const state = formData.get('state') || null;
    const custom_state_name = formData.get('custom_state_name')?.trim() || null;
    const location_city = formData.get('location_city')?.trim() || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const graduated = formData.get('graduated') === 'true' ? 1 : 0;
    const honors = formData.get('honors')?.trim() || null;
    const transcript_url = formData.get('transcript_url')?.trim() || null;
    const notes = formData.get('notes')?.trim() || null;

    await pool.execute(
      `UPDATE C_EMPLOYEE_EDUCATION 
       SET degree_name=?, major=?, institution=?, country=?, state=?, custom_state_name=?,
           location_city=?, start_date=?, end_date=?, graduated=?, honors=?, transcript_url=?, notes=?
       WHERE id=?`,
      [degree_name, major, institution, country, state, custom_state_name,
       location_city, start_date, end_date, graduated, honors, transcript_url, notes, id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating education:', error);
    return { error: 'Failed to update education record' };
  }
}

export async function deleteEducation(id) {
  try {
    const pool = await DBconnection();
    await pool.execute('DELETE FROM C_EMPLOYEE_EDUCATION WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting education:', error);
    return { error: 'Failed to delete education record' };
  }
}

// ============ EXPERIENCE FUNCTIONS ============

export async function fetchExperienceByEmpId(empid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT 
        id,
        employee_id,
        organization_name,
        location_city,
        location_country,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        currently_working,
        description,
        achievements,
        supervisor_name,
        supervisor_email,
        created_at,
        updated_at
      FROM C_EMPLOYEE_EXPERIENCE 
      WHERE employee_id = ? 
      ORDER BY start_date DESC`,
      [empid]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching experience:', error);
    throw new Error('Failed to fetch experience records');
  }
}

export async function addExperience(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Authentication required' };

    const decoded = decodeJwt(token);
    if (!decoded?.orgid) return { error: 'Invalid token' };

    const pool = await DBconnection();
    
    const employee_id = formData.get('employee_id');
    const organization_name = formData.get('organization_name')?.trim() || null;
    const location_city = formData.get('location_city')?.trim() || null;
    const location_country = formData.get('location_country') || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const currently_working = formData.get('currently_working') === 'true' ? 1 : 0;
    const description = formData.get('description')?.trim() || null;
    const achievements = formData.get('achievements')?.trim() || null;
    const supervisor_name = formData.get('supervisor_name')?.trim() || null;
    const supervisor_email = formData.get('supervisor_email')?.trim() || null;

    const [result] = await pool.execute(
      `INSERT INTO C_EMPLOYEE_EXPERIENCE 
       (employee_id, organization_name, location_city, location_country, start_date, end_date, 
        currently_working, description, achievements, supervisor_name, supervisor_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, organization_name, location_city, location_country, start_date, end_date,
       currently_working, description, achievements, supervisor_name, supervisor_email]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Error adding experience:', error);
    return { error: 'Failed to add experience record' };
  }
}

export async function updateExperience(formData) {
  try {
    const pool = await DBconnection();
    
    const id = formData.get('id');
    const organization_name = formData.get('organization_name')?.trim() || null;
    const location_city = formData.get('location_city')?.trim() || null;
    const location_country = formData.get('location_country') || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const currently_working = formData.get('currently_working') === 'true' ? 1 : 0;
    const description = formData.get('description')?.trim() || null;
    const achievements = formData.get('achievements')?.trim() || null;
    const supervisor_name = formData.get('supervisor_name')?.trim() || null;
    const supervisor_email = formData.get('supervisor_email')?.trim() || null;

    await pool.execute(
      `UPDATE C_EMPLOYEE_EXPERIENCE 
       SET organization_name=?, location_city=?, location_country=?, start_date=?, end_date=?, 
           currently_working=?, description=?, achievements=?, supervisor_name=?, supervisor_email=?
       WHERE id=?`,
      [organization_name, location_city, location_country, start_date, end_date,
       currently_working, description, achievements, supervisor_name, supervisor_email, id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating experience:', error);
    return { error: 'Failed to update experience record' };
  }
}

export async function deleteExperience(id) {
  try {
    const pool = await DBconnection();
    await pool.execute('DELETE FROM C_EMPLOYEE_EXPERIENCE WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting experience:', error);
    return { error: 'Failed to delete experience record' };
  }
}