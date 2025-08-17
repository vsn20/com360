'use server';
import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Helper Functions
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

const getdisplayprojectid = (prjid) => {
  return prjid.split('_')[1] || prjid;
};

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId, 'orgid:', orgId);
      return 'unknown';
    }
    let empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid, 'orgid:', orgId);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    empid = getdisplayprojectid(empid);
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

async function generateOfferLetterPdf(offerLetterData, details, orgid, employeename) {
  const pool = await DBconnection();
  const [rows] = await pool.query(`SELECT orgname FROM C_ORG WHERE orgid = ?`, [orgid]);
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { success: false, error: 'No token found. Please log in.' };

  const decoded = decodeJwt(token);
  const empid = decoded.empid;

   let state;
  if(offerLetterData.stateid!=null){
 [state] = await pool.query(
    `select VALUE from C_STATE where ID=?`,
    [offerLetterData.stateid]
  );
    state = state[0].VALUE
}
else{
  state =  offerLetterData.custom_state_name;
}
  

  let [country] = await pool.query(`SELECT VALUE FROM C_COUNTRY WHERE ID = ?`, [offerLetterData.countryid]);
  country = country[0]?.VALUE || offerLetterData.countryid;

  const [jobtitleforempid] = await pool.query(`SELECT JOB_TITLE FROM C_EMP WHERE empid = ?`, [empid]);
  let jobstitle = jobtitleforempid[0]?.JOB_TITLE;
  const [realtitle] = await pool.query(
    `SELECT job_title FROM org_jobtitles WHERE job_title_id = ? AND orgid = ?`,
    [jobstitle, orgid]
  );
  jobstitle = realtitle[0]?.job_title;

  const [jobtype] = await pool.query('SELECT Name FROM generic_values WHERE id = ? AND orgid = ?', [parseInt(offerLetterData.finalised_jobtype), orgid]);
  const s = jobtype[0]?.Name;

  const [reportToRows] = await pool.query(
    `SELECT EMP_FST_NAME, EMP_LAST_NAME, JOB_TITLE FROM C_EMP WHERE empid = ?`,
    [offerLetterData.reportto_empid]
  );
  let titlejob = 'Manager';
  if (reportToRows.length > 0 && reportToRows[0].JOB_TITLE) {
    const [titlejobRows] = await pool.query(
      `SELECT job_title FROM org_jobtitles WHERE job_title_id = ? AND orgid = ?`,
      [reportToRows[0].JOB_TITLE, orgid]
    );
    titlejob = titlejobRows.length > 0 ? titlejobRows[0].job_title : 'Manager';
  }
  const reportToName = reportToRows.length > 0 ? `${reportToRows[0].EMP_FST_NAME} ${reportToRows[0].EMP_LAST_NAME}` : 'Unknown';
  const reportToTitle = titlejob;

  let finalisedJobTitleName = offerLetterData.finalised_jobtitle;
  if (offerLetterData.finalised_jobtitle) {
    const [jobTitleRows] = await pool.query(
      `SELECT job_title FROM org_jobtitles WHERE job_title_id = ? AND orgid = ? AND is_active = 1`,
      [offerLetterData.finalised_jobtitle, orgid]
    );
    finalisedJobTitleName = jobTitleRows.length > 0 ? jobTitleRows[0].job_title : 'Not specified';
  }

  let finalisedDepartmentName = offerLetterData.finalised_department;
  if (offerLetterData.finalised_department) {
    const [deptRows] = await pool.query(
      `SELECT name FROM org_departments WHERE id = ? AND orgid = ? AND isactive = 1`,
      [offerLetterData.finalised_department, orgid]
    );
    finalisedDepartmentName = deptRows.length > 0 ? deptRows[0].name : 'Not specified';
  }

  const roleids = offerLetterData.finalised_roleids || [];
  let roleNames = [];
  if (roleids.length > 0) {
    const placeholders = roleids.map(() => '?').join(',');
    const [roleRows] = await pool.query(
      `SELECT rolename FROM org_role_table WHERE roleid IN (${placeholders}) AND orgid = ? AND is_active = 1`,
      [...roleids, orgid]
    );
    roleNames = roleRows.map(row => row.rolename);
  }

  const orgname = rows[0]?.orgname;
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 11;
  const margin = 50;
  let y = height - margin;

  const logoPath = path.join(process.cwd(), 'public', 'uploads', 'orglogos', `${orgid}.jpg`);
  let logoImage;
  try {
    const logoBytes = fs.readFileSync(logoPath);
    logoImage = await pdfDoc.embedJpg(logoBytes);
  } catch (error) {
    console.error('Error loading logo image:', error.message);
  }

  if (logoImage) {
    const logoWidth = 50;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    page.drawImage(logoImage, { x: margin, y: y - logoHeight, width: logoWidth, height: logoHeight });
    y -= (logoHeight + 20);
  }

  let signatureImage;
  const signatureJpgPath = path.join(process.cwd(), 'public', 'Uploads', 'signatures', `${empid}.jpg`);
  try {
    const signatureBytes = fs.readFileSync(signatureJpgPath);
    signatureImage = await pdfDoc.embedJpg(signatureBytes);
  } catch (error) {
    console.error('Error loading signature image:', error.message);
  }

  const drawLine = (text, size = fontSize, isBold = false) => {
    page.drawText(text, {
      x: margin,
      y: y,
      font: isBold ? timesRomanBoldFont : timesRomanFont,
      size: size,
      color: rgb(0, 0, 0),
      lineHeight: size + 4,
    });
    y -= (size + 6);
  };

  const drawParagraph = (text, size = fontSize, lineGap = 18, isBold = false) => {
    const lines = [];
    const maxWidth = width - margin * 2;
    let currentLine = '';
    text.split(' ').forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = (isBold ? timesRomanBoldFont : timesRomanFont).widthOfTextAtSize(testLine, size);
      if (textWidth < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    lines.push(currentLine);
    lines.forEach(line => {
      drawLine(line, size, isBold);
    });
    y -= (lineGap - (size + 6));
  };

  y -= 20;
  drawLine(`${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`, fontSize, true);
  y -= 20;
  drawLine(`${details.first_name} ${details.last_name}`, fontSize, true);
  y -= 20;
  drawLine(`Re: Offer of Employment`, fontSize, true);
  y -= 20;
  drawLine(`Dear ${details.gender === 'male' ? 'Mr.' : 'Mrs.'} ${details.first_name} ${details.last_name}:`, fontSize, true);
  y -= 10;
  drawParagraph(`By this letter, ${orgname} hereby extends to you an offer of employment under the following terms and conditions.`, fontSize, 18, true);
  drawParagraph(`1. Start Date.`, fontSize, 18, true);
  drawParagraph(`${new Date(offerLetterData.expected_join_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. You will be based in our office located at ${offerLetterData.adress_lane_1}, ${offerLetterData.adress_lane_2 || ''}, ${offerLetterData.zipcode}, ${state}, ${country}.`);
  drawParagraph(`2. Title and Roles.`, fontSize, 18, true);
  drawParagraph(`Your title will be ${finalisedJobTitleName} at ${orgname}. You will be assigned the following role(s): ${roleNames.length > 0 ? roleNames.join(', ') : 'Not specified'}.`);
  drawParagraph(`3. Compensation.`, fontSize, 18, true);
  drawParagraph(`You will be compensated on a ${offerLetterData.finalised_pay_term.toLowerCase()} basis. You will be paid $${offerLetterData.finalised_salary} per ${offerLetterData.finalised_pay_term.toLowerCase()}, payable in ${orgname}'s customary payroll payment procedures. You will work on a ${s} basis for ${orgname}.`);
  drawParagraph(`4. Fringe Benefits.`, fontSize, 18, true);
  drawParagraph(`You will be entitled to ${orgname}'s customary employee benefits afforded to similarly situated ${orgname} employees.`);
  drawParagraph(`5. Employment Agreement.`, fontSize, 18, true);
  drawParagraph(`This agreement will be executed by ${orgname} and you. Our goal is to work together to continue to build our business. You will report directly to ${reportToName}, ${reportToTitle}. All work assignments will be given to you by ${orgname}. You will be a direct employee of ${orgname}. Your work schedule will be set by ${orgname}. Your performance reviews will be performed by ${orgname}. Only ${orgname} has the ability to hire, fire, or discipline you for poor work performance. You will use ${orgname}’s tools / instrumentalities to perform the duties of your employment. Our desire is to have a long-term relationship with you in which your compensation and role in the company are based on your performance and contribution to the company. Your employment relationship with ${orgname} is at-will. You may terminate your employment with ${orgname} at any time and for any reason whatsoever simply by notifying ${orgname}. Likewise, ${orgname} may terminate your employment at any time and for any reason whatsoever, with or without cause or advance notice. This at-will employment relationship cannot be changed except in a writing signed by a Company officer.`);
  y -= 10;
  drawParagraph(`We are genuinely excited about you joining ${orgname}. We look forward to a long, enjoyable, challenging, and mutually beneficial relationship with you.`);
  y -= 20;
  drawLine(`Sincerely,`, fontSize, true);

  if (signatureImage) {
    const signatureWidth = 50;
    const signatureHeight = (signatureImage.height / signatureImage.width) * signatureWidth;
    page.drawImage(signatureImage, { x: margin, y: y - signatureHeight, width: signatureWidth, height: signatureHeight });
    y -= (signatureHeight + 20);
  } else {
    drawLine(`${employeename}`, fontSize, true);
  }

  const page2 = pdfDoc.addPage();
  y = page2.getSize().height - margin;

  if (logoImage) {
    const logoWidth = 50;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    page2.drawImage(logoImage, { x: margin, y: y - logoHeight, width: logoWidth, height: logoHeight });
    y -= (logoHeight + 20);
  }

  const drawLine2 = (text, size = fontSize, isBold = false) => {
    page2.drawText(text, { x: margin, y, font: isBold ? timesRomanBoldFont : timesRomanFont, size });
    y -= (size + 6);
  };

  drawLine2(`${orgname}`, fontSize, true);
  drawLine2(`${employeename}`, fontSize, true);
  drawLine2(`${jobstitle}`, fontSize, true);
  y -= 40;
  drawLine2(`AGREED and ACCEPTED:`, fontSize, true);
  y -= 40;
  drawLine2(`_____________________`);
  drawLine2(`${details.first_name} ${details.last_name}`, fontSize, true);
  y -= 40;
  drawLine2(`Date:_________________`);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function fetchalldetails(interviewid) {
  try {
    const pool = await DBconnection();
    const [mainRows] = await pool.query(
      `SELECT 
        a.orgid, a.interview_id, a.application_id, b.applieddate, b.jobid, b.status,
        b.resumepath, b.salary_expected, b.custom_salary_by_interviewer, b.offerletter_timestamp,
        c.first_name, c.last_name, c.email, c.mobilenumber, c.dateofbirth, c.addresslane1,
        c.addresslane2, c.zipcode, c.gender, e.display_job_name,e.expected_job_title,e.addresslane1 as a1,e.addresslane2 as a2,e.zipcode as z1,e.stateid as s1,e.custom_state_name as s2,e.countryid as c1,e.expected_role as role1,e.expected_department as d1,e.job_type as job1,z.job_title,z.max_salary,z.min_salary,z.level
      FROM interview_table AS a
      JOIN applications AS b ON a.application_id = b.applicationid
      JOIN candidate AS c ON b.candidate_id = c.cid
      JOIN externaljobs AS e ON b.jobid = e.jobid
      JOIN org_jobtitles as z on z.job_title_id=e.expected_job_title
      WHERE a.interview_id = ?`,
      [interviewid]
    );

    if (mainRows.length === 0) {
      return { success: false, error: 'No details found for the selected interview.' };
    }

    const [panelRows] = await pool.query(
      `SELECT empid, email, is_he_employee FROM interview_panel WHERE interview_id = ?`,
      [interviewid]
    );
    
    const [department]=await pool.query(
      `SELECT name FROM org_departments WHERE id = ?  AND isactive = 1`,
      [mainRows[0].d1]
    );
    const departmentname=department[0].name;


     const [jobtype] = await pool.query('select Name from generic_values where id=?', [parseInt(mainRows[0].job1)]);
  const jobtypename = jobtype[0].Name;


  let state;
   let statename;


  if(mainRows[0].s1!=null){
    [state] = await pool.query(
    `select VALUE from C_STATE where ID=?`,
    [mainRows[0].s1]
  );
 statename = state[0].VALUE;
}
  else{
    statename='';
  }

  let [country] = await pool.query(
    `select VALUE from C_COUNTRY where ID=?`, [mainRows[0].c1]
  );
let  countryname = country[0].VALUE||'';

    

    const [offerRows] = await pool.query(
      `SELECT 
        finalised_salary, finalised_jobtitle, finalised_department,
        finalised_jobtype, finalised_pay_term, expected_join_date, reportto_empid,
        adress_lane_1, adress_lane_2, zipcode, stateid, countryid, custom_state_name, 
        offerletter_url, offer_letter_sent
      FROM offerletters
      WHERE applicationid = ?`,
      [mainRows[0]?.application_id]
    );

    // Fetch roleids from application_role_assign
    const [roleRows] = await pool.query(
      `SELECT roleid FROM application_role_assign WHERE applicationid = ? AND orgid = ?`,
      [mainRows[0]?.application_id, mainRows[0]?.orgid]
    );

    // Fetch rounds and their panel members
    const [roundsRows] = await pool.query(
      `SELECT r.*, ip.empid AS panel_empid, ip.email, ip.is_he_employee
       FROM C_INTERVIEW_ROUNDS r
       LEFT JOIN interview_panel ip ON r.Roundid = ip.Roundid AND r.orgid = ip.orgid AND r.interview_id = ip.interview_id
       WHERE r.interview_id = ? AND r.orgid = ?`,
      [interviewid, mainRows[0].orgid]
    );

    const rounds = roundsRows.reduce((acc, row) => {
      let round = acc.find(r => r.Roundid === row.Roundid);
      if (!round) {
        round = {
          Roundid: row.Roundid,
          orgid: row.orgid,
          interview_id: row.interview_id,
          application_id: row.application_id,
          RoundNo: row.RoundNo,
          marks: row.marks,
          comments: row.comments,
          status: row.status,
          start_date: row.start_date,
          start_am_pm: row.start_am_pm,
          end_date: row.end_date,
          end_am_pm: row.end_am_pm,
          start_time: row.start_time,
          end_time: row.end_time,
          meeting_link: row.meeting_link,
          Confirm: row.Confirm,
          panelMembers: [],
        };
        acc.push(round);
      }
      if (row.panel_empid) {
        round.panelMembers.push({
          empid: row.panel_empid,
          email: row.email,
          is_he_employee:row.is_he_employee,
        });
      }
      return acc;
    }, []);

    return {
      success: true,
      data: {
        ...mainRows[0],
        departmentname,
        jobtypename,
        statename,countryname,
        panel_members: panelRows || [],
        offerletter: offerRows[0] ? {
          ...offerRows[0],
          finalised_roleids: roleRows.map(row => row.roleid),
        } : null,
        rounds: rounds,
      },
    };
  } catch (error) {
    console.error('Error fetching interview details:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchDropdownData(orgid) {
  try {
    const pool = await DBconnection();
    const [departments] = await pool.query('SELECT id, name FROM org_departments WHERE orgid = ? AND isactive = 1', [orgid]);
    const [payFrequencies] = await pool.query('SELECT id, Name FROM generic_values WHERE g_id = 4 AND orgid = ? AND isactive = 1', [orgid]);
    const [jobTitles] = await pool.query('SELECT job_title_id, job_title, level, min_salary, max_salary FROM org_jobtitles WHERE orgid = ? AND is_active = 1', [orgid]);
    const [countries] = await pool.query('SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1');
    const [states] = await pool.query('SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1');
    const [employeeRows] = await pool.query('SELECT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME FROM C_EMP e WHERE e.orgid = ?', [orgid]);
    const [jobtype] = await pool.query('SELECT id, g_id, Name FROM generic_values WHERE g_id = 14 AND isactive = 1 AND orgid = ?', [orgid]);
    const [roles] = await pool.query('SELECT roleid, rolename FROM org_role_table WHERE orgid = ? AND is_active = 1', [orgid]);

    const employees = employeeRows.map(emp => ({
      empid: emp.empid,
      name: `${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME}`,
    }));

    return {
      success: true,
      data: { departments, payFrequencies, jobTitles, countries, states, employees, jobtype, roles },
    };
  } catch (error) {
    console.error('Error fetching dropdown data:', error);
    return { success: false, error: error.message };
  }
}

export async function updateStatus(applicationid, status, interview_id) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { success: false, error: 'No token found. Please log in.' };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) return { success: false, error: 'Invalid token.' };

  const { userId, orgid } = decoded;

  try {
    const pool = await DBconnection();
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [result] = await connection.query(
        'UPDATE applications SET status = ? WHERE applicationid = ?',
        [status, applicationid]
      );

      if (status !== 'offerletter-generated') {
        await connection.query(
          'UPDATE offerletters SET confirmed = 0 WHERE applicationid = ?',
          [applicationid]
        );
      } else {
        await connection.query(
          'UPDATE interview_table SET offer_letter_generated = 1 WHERE interview_id = ?',
          [interview_id]
        );
      }

      const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
      const description = `Status(${status}) changed by ${employeename}(after interviewing and offer letter reviewing) on ${new Date().toISOString()}`;
      await connection.query(
        'INSERT INTO applications_activity (orgid, application_id, activity_description) VALUES (?, ?, ?)',
        [orgid, applicationid, description]
      );

      await connection.commit();

      if (result.affectedRows > 0) {
        return { success: true, message: 'Status updated successfully' };
      } else {
        return { success: false, error: 'No rows updated' };
      }
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating status:', error);
    return { success: false, error: error.message };
  }
}

export async function saveOfferLetter(applicationid, offerLetterData, orgid, details) {
  try {
    const pool = await DBconnection();
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const normalizedApplicationId = applicationid;

      const [existingOffer] = await connection.query(
        'SELECT offer_letter_sent FROM offerletters WHERE applicationid = ?',
        [normalizedApplicationId]
      );

      if (existingOffer.length > 0 && existingOffer[0].offer_letter_sent === 1) {
        await connection.rollback();
        return { success: false, error: 'Cannot update: Offer letter has already been sent.' };
      }

      const roleids = [...new Set(offerLetterData.finalised_roleids || [])];
      if (roleids.length === 0) {
        await connection.rollback();
        return { success: false, error: 'At least one role is required.' };
      }

      for (const roleid of roleids) {
        const [role] = await connection.execute(
          'SELECT roleid FROM org_role_table WHERE roleid = ? AND orgid = ? AND is_active = 1',
          [roleid, orgid]
        );
        if (role.length === 0) {
          await connection.rollback();
          return { success: false, error: `Invalid or inactive role selected: ${roleid}` };
        }
      }

      if (offerLetterData.finalised_jobtitle) {
        const [jobTitle] = await connection.execute(
          'SELECT job_title_id FROM org_jobtitles WHERE job_title_id = ? AND orgid = ? AND is_active = 1',
          [offerLetterData.finalised_jobtitle, orgid]
        );
        if (jobTitle.length === 0) {
          await connection.rollback();
          return { success: false, error: `Invalid or inactive job title selected: ${offerLetterData.finalised_jobtitle}` };
        }
      }

      if (offerLetterData.finalised_department) {
        const [dept] = await connection.execute(
          'SELECT id FROM org_departments WHERE id = ? AND orgid = ? AND isactive = 1',
          [offerLetterData.finalised_department, orgid]
        );
        if (dept.length === 0) {
          await connection.rollback();
          return { success: false, error: `Invalid or inactive department selected: ${offerLetterData.finalised_department}` };
        }
      }

      const timestamp = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
      const offerletterPath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'offerletter',
        `${applicationid}_${timestamp}.pdf`
      );
      const offerletter_url = `/uploads/offerletter/${applicationid}_${timestamp}.pdf`;

      const requiredFields = [
        'finalised_salary', 'finalised_jobtitle', 'finalised_department',
        'finalised_jobtype', 'finalised_pay_term', 'reportto_empid', 'zipcode',
        'countryid', 'expected_join_date'
      ];
      if (requiredFields.some(field => !offerLetterData[field] && offerLetterData[field] !== '')) {
        const missing = requiredFields.filter(field => !offerLetterData[field] && offerLetterData[field] !== '');
        await connection.rollback();
        return { success: false, error: `Missing required fields: ${missing.join(', ')}` };
      }

      const dir = path.dirname(offerletterPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const decoded = decodeJwt(cookies().get("jwt_token")?.value);
      if (!decoded || !decoded.userId) {
        await connection.rollback();
        return { success: false, error: 'Invalid token.' };
      }
      const employeename = await getCurrentUserEmpIdName(pool, decoded.userId, orgid);
      const pdfBytes = await generateOfferLetterPdf(offerLetterData, details, orgid, employeename);
      fs.writeFileSync(offerletterPath, pdfBytes);

      const [existingRows] = await connection.query(
        'SELECT applicationid FROM offerletters WHERE applicationid = ?',
        [normalizedApplicationId]
      );

      if (existingRows.length > 0) {
        const [result] = await connection.query(
          `UPDATE offerletters SET
            offerletter_url = ?,
            offerletter_generated_timestamp = NOW(),
            expected_join_date = ?,
            adress_lane_1 = ?,
            adress_lane_2 = ?,
            zipcode = ?,
            stateid = ?,
            countryid = ?,
            custom_state_name = ?,
            finalised_salary = ?,
            finalised_jobtitle = ?,
            finalised_department = ?,
            finalised_jobtype = ?,
            finalised_pay_term = ?,
            reportto_empid = ?,
            confirmed = 1,
            offer_letter_sent = 0
          WHERE applicationid = ?`,
          [
            offerletter_url, offerLetterData.expected_join_date,
            offerLetterData.adress_lane_1 || '', offerLetterData.adress_lane_2 || '',
            offerLetterData.zipcode, offerLetterData.stateid||'', offerLetterData.countryid,
            offerLetterData.custom_state_name || '', offerLetterData.finalised_salary,
            offerLetterData.finalised_jobtitle, offerLetterData.finalised_department,
            offerLetterData.finalised_jobtype, offerLetterData.finalised_pay_term,
            offerLetterData.reportto_empid, normalizedApplicationId
          ]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          return { success: false, error: `Failed to update offer letter for applicationid: ${normalizedApplicationId}.` };
        }
      } else {
        const [result] = await connection.query(
          `INSERT INTO offerletters (
            applicationid, offerletter_url, offerletter_generated_timestamp, expected_join_date,
            adress_lane_1, adress_lane_2, zipcode, stateid, countryid, custom_state_name,
            finalised_salary, finalised_jobtitle, finalised_department,
            finalised_jobtype, finalised_pay_term, reportto_empid, confirmed, offer_letter_sent
          ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
          [
            normalizedApplicationId, offerletter_url, offerLetterData.expected_join_date,
            offerLetterData.adress_lane_1 || '', offerLetterData.adress_lane_2 || '',
            offerLetterData.zipcode, offerLetterData.stateid, offerLetterData.countryid,
            offerLetterData.custom_state_name || '', offerLetterData.finalised_salary,
            offerLetterData.finalised_jobtitle, offerLetterData.finalised_department,
            offerLetterData.finalised_jobtype, offerLetterData.finalised_pay_term,
            offerLetterData.reportto_empid
          ]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          return { success: false, error: `Failed to insert offer letter for applicationid: ${normalizedApplicationId}.` };
        }
      }

      const [deleteResult] = await connection.query(
        'DELETE FROM application_role_assign WHERE applicationid = ? AND orgid = ?',
        [normalizedApplicationId, orgid]
      );

      for (const roleid of roleids) {
        const [roleAssignResult] = await connection.query(
          `INSERT INTO application_role_assign (applicationid, orgid, roleid) 
           VALUES (?, ?, ?) 
           ON DUPLICATE KEY UPDATE roleid = roleid`,
          [normalizedApplicationId, orgid, roleid]
        );
      }

      const [salaryResult] = await connection.query(
        `UPDATE applications SET custom_salary_by_interviewer = ? WHERE applicationid = ?`,
        [offerLetterData.finalised_salary, normalizedApplicationId]
      );

      if (salaryResult.affectedRows === 0) {
        await connection.rollback();
        return { success: false, error: `Failed to update custom_salary_by_interviewer for applicationid: ${normalizedApplicationId}.` };
      }

      await connection.commit();
      return { success: true, message: 'Offer letter saved and PDF generated successfully', offerletter_url };
    } catch (error) {
      await connection.rollback();
      console.error('Error in saveOfferLetter transaction for applicationid:', applicationid, 'Error:', error);
      return { success: false, error: `Transaction error: ${error.message}` };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error establishing database connection for applicationid:', applicationid, 'Error:', error);
    return { success: false, error: `Database connection error: ${error.message}` };
  }
}