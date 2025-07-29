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


export async function fetchdetailsRemaining(interviewdetails,time){
   console.log("interview details in Remaining server",interviewdetails);
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
         return currentTime < startDateTime;
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

