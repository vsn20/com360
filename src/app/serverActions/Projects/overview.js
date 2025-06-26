"use server"

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

export async function fetchprojectsbyorgid()
{
     try 
     {
        const cookieStore = cookies();
        const token = cookieStore.get('jwt_token')?.value;
    
        if (!token) {
          console.log('No token found');
          throw new Error('No token found. Please log in.');
        }
    
        const decoded = decodeJwt(token);
        if (!decoded || !decoded.orgid) {
          console.log('Invalid token or orgid not found');
          throw new Error('Invalid token or orgid not found.');
        }
    
        const orgId = decoded.orgid;
        if (!orgId) {
          console.log('orgId is undefined or invalid');
          throw new Error('Organization ID is missing or invalid.');
        }
    
        console.log(`Fetching projects for orgId: ${orgId}`);
        const pool=await DBconnection();
        console.log("mysql coonected");
        const [rows]=await pool.execute(
            `select PRJ_ID,PRJ_NAME,PRS_DESC,ACCNT_ID FROM C_PROJECT WHERE ORG_ID=? `,[orgId]
        );
        console.log('fetched projects:',rows);
        return rows;
    }
    catch (error) {
    console.error('Error fetching projects:', error.message);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
    
}