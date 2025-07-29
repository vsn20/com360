'use server';
import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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


export async function fetchdetailsconfirm(interviewdetails, time) {
  console.log("interview details in confirm server", interviewdetails);
  console.log("time", time);

  const formatDate = (date) => {
    if (!date || date === '0000-00-00' || date === 'null') return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  const formatTime = (time, am_pm, start_date, end_date, start_am_pm) => {
    if (!time || time === 'null') return '';
    const effectiveAmPm = (!am_pm || am_pm === 'null') && start_date === end_date && start_am_pm ? start_am_pm : (am_pm || 'AM');
    return `${time} ${effectiveAmPm}`;
  };

  try {
    const hoursOffset = time && time.length > 0 ? parseInt(time[0].Name, 10) : 0;
    if (isNaN(hoursOffset)) {
      console.error('Invalid hours offset in time prop:', time);
      throw new Error('Invalid hours offset');
    }

    // Filter interviews where time has exceeded and interview_completed = 0
   
    const filteredDetails = interviewdetails.filter((interview) => {
      // Check if interview is not completed
      if (interview.interview_completed !== 0) {
        return false;
      }

      // Check if time has exceeded
      const formattedStartDate = formatDate(interview.start_date);
      if (!formattedStartDate) {
        console.warn('Invalid start_date format:', interview.start_date);
        return false;
      }

      const [year, month, day] = formattedStartDate.split('-').map(Number);
      let [hours, minutes] = (interview.start_time).split(':').map(Number);
      if (interview.start_am_pm === 'PM' && hours !== 12) hours += 12;
      if (interview.start_am_pm === 'AM' && hours === 12) hours = 0;

      const startDateTime = new Date(year, month - 1, day, hours, minutes);
      startDateTime.setHours(startDateTime.getHours() - hoursOffset);
       const currentTime = new Date();
      return currentTime > startDateTime;
    });

    // Optionally, fetch additional employee details if needed
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    let orgid = null;
    let empid = null;

    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;
        empid = decoded.empid;
      }
    }

    // If you need to fetch additional employee details, query the database
    console.log("filtered interview",filteredDetails);
    return {
      success: true,
      interviews: filteredDetails,
    };
  } catch (error) {
    console.error('Error in fetchdetailsconfirm:', error);
    return {
      success: false,
      error: 'Failed to fetch interview details',
    };
  }
}

export async function fetchdetailsbyid(details,id){
    console.log("details:-",details);
    console.log("id",id);


    try {
        const alldetails=details.filter((detail)=>{
        return detail.interview_id===id
    })

     console.log("filtered interview",alldetails);
    return {
      success: true,
      interviews: alldetails,
    };

    } 
    catch (error) 
    {
      console.error('Error in fetchdetailsconfirm:', error);
    return {
      success: false,
      error: 'Failed to fetch interview details',
    };
    }   
}



export async function updateInterviewStatus({ orgid, empid, interview_id, status }) {
     const cookieStore = cookies();
      const token = cookieStore.get("jwt_token")?.value;
    
      if (!token) {
        console.log('Redirecting: No token found');
        return { error: 'No token found. Please log in.' };
      }
    
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.userId) {
        console.log('Redirecting: Invalid token or orgid/userId not found');
        return { error: 'Invalid token or orgid/userId not found.' };
      }
      const userId = decoded.userId;
    
  try {
    const pool = await DBconnection();
    const [result] = await pool.query(
      `UPDATE interview_table 
       SET interview_completed = 1
       WHERE orgid = ? AND interview_id = ?`,
      [orgid, interview_id]
    );
   const [applicationid]=await pool.query(
    `select a.applicationid from applications as a join interview_table as b on a.applicationid=b.application_id where b.interview_id=?`
    ,[interview_id]
   );
   const appid=applicationid[0].applicationid
   console.log(applicationid);

    if(status=='offerletter-processing')
    {
        const[m]=await pool.query(
        `update applications set offerletter_timestamp=?,status=? where orgid=? and applicationid=?`,
        [new Date,status,orgid,appid]
    );
    }else{
        const[s]=await pool.query(
        `update applications set status=?,offerletter_timestamp=? where orgid=? and applicationid=?`,
        [status,null,orgid,appid]
    );
    }

    const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
    console.log('Employee Name:', employeename);
    const description = `Status(${status}) changed by ${employeename}(after interviewing) on ${new Date().toISOString()}`;
    await pool.query(
      `INSERT INTO applications_activity (orgid, application_id, activity_description) VALUES (?, ?, ?)`,
      [orgid, appid, description]
    );

    
    if (result.affectedRows === 0) {
      console.error('No interview found to update:', { orgid, interview_id });
      return {
        success: false,
        error: 'No interview found to update',
      };
    }

    console.log('Interview status updated:', { interview_id, status });
    return {
      success: true,
      message: 'Interview status updated successfully',
    };
  } catch (error) {
    console.error('Error in updateInterviewStatus:', error);
    return {
      success: false,
      error: 'Failed to update interview status',
    };
  }
}