import React from 'react';
import Overview from '@/app/components/Roles/Overview';
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';

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

export default async function AddRolePage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  let orgid = null;
  let currentRole = null;
  let noofrows=null;
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    orgid = decoded.orgid;

    const pool = await DBconnection();
    try {
      const [roleRows] = await pool.query(
        `SELECT r.rolename, r.roleid 
         FROM emp_role_assign era 
         JOIN org_role_table r ON era.roleid = r.roleid 
         WHERE era.empid = ? AND r.orgid = ?`,
        [decoded.empid, orgid]
      );

      if (roleRows && roleRows.length > 0) {
        currentRole = roleRows[0].rolename || roleRows[0].roleid.toString();
      } else {
        console.log('No active role found for empid:', decoded.empid);
      }

      const[noofrowsintable]=await pool.query(
        `select id,Name from generic_values where g_id=17 and orgid=? and isactive=1 LIMIT 1`,
        [orgid]
      );
      noofrows=noofrowsintable[0];
      console.log("ssssssssssssssssssssssss",noofrows);

    }
    catch(error){
      console.error('Error decoding token or fetching role:', error);
    }
  } catch (error) {
    console.error('Error decoding token or fetching role:', error);
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Role</h1>
        <p style={{ color: "red" }}>Error fetching user details: {error.message}</p>
      </div>
    );
  }

  return (
    <Overview
      currentRole={currentRole}
      orgid={orgid}
      noofrows={noofrows}
      error={error}
    />
  );
}