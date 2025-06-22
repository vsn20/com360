'use server';

import DBconnection from "../utils/config/db";
import { cookies } from "next/headers";

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]; // Get the payload part
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export async function getAllroles(){
    try {
        const cookieStore=cookies();
        const token=cookieStore.get('jwt_token')?.value;

        if(!token){
            return {success: false, error: 'No token found. Please log in.'}
        }
        const decoded=decodeJwt(token);
         if (!decoded || !decoded.roleid) {
         return { success: false, error: 'Invalid token or roleid not found.' };
        }
        const adminroleid=decoded.roleid;

        const pool=await DBconnection();

        const[roleRows]=await pool.query(
            'select orgid from org_role_table where roleid=?' ,
            [adminroleid]
        );
     if (!roleRows || roleRows.length === 0) {
      return { success: false, error: 'Admin role not found or not an admin.' };
    }

    const orgid=roleRows[0].orgid;

    const [getroles]=await pool.query(
        'select * from org_role_table where orgid=?',
        [orgid]
    );
   
     if (!getroles || getroles.length === 0) {
      return { success: true, roles: [] }; // No features accessible
    }
    return {success:true,roles:getroles}

    } catch (error) {
         console.error('Error fetching features:', error);
    return { success: false, error: 'Failed to fetch features: ' + error.message };
  }
    
}