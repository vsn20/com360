'use server'
import DBconnection from "@/app/utils/config/db"
import { cookies } from "next/headers"



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

export async function Filter(interviewdetails,acceptingtime)
{
    const filtereddetails=interviewdetails.filter
  ((interview)=>
    {
     if (interview.offerletter_timestamp) 
       {
         const acceptingHours = acceptingtime ? parseInt(acceptingtime, 10) : 0;
         if (isNaN(acceptingHours)) 
            {
              console.error('Invalid acceptingtime:', acceptingtime);
              return { success: false, error: 'Invalid accepting time' };
            }
         const offerTimestamp = new Date(interview.offerletter_timestamp);
         const currentTime = new Date();
         const maxEditTime = new Date(offerTimestamp.getTime() + acceptingHours * 60 * 60 * 1000);
         return currentTime > maxEditTime;
        }else{
            return false;
        }
    }
  
  )
    console.log("inteeeee",filtereddetails);
 return{
        success:true,
        f:filtereddetails,
    };
}