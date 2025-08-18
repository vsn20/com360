"use server";

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Addaccount from "@/app/components/Account/Addaccount";
import DBconnection from "@/app/utils/config/db";
import { fetchCountryStateData } from "@/app/serverActions/getcountry";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function Page({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.error("No token found, redirecting to login");
    redirect("/login");
  }

  let orgid;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.orgid) {
      console.error("Invalid token: orgId not found");
      redirect("/login");
    }
    orgid = decoded.orgid;
  } catch (err) {
    console.error("Error verifying JWT:", err.message);
    redirect("/login");
  }

  // Initialize variables
  let countries = [];
  let states = [];
  let accountTypes = [];
  let branchTypes = [];

  try {
    // Fetch countries and states
    const { countries: countryData, states: stateData } = await fetchCountryStateData();
    countries = countryData;
    states = stateData;

    // Establish database connection for account and branch types
    const pool = await DBconnection();

    // Fetch active account types (g_id = 5)
    [accountTypes] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
      [5, orgid]
    );

    // Fetch active branch types (g_id = 6)
    [branchTypes] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
      [6, orgid]
    );

  } catch (err) {
    console.error('Error fetching data:', err);
    // Proceed with partial data
  }

  return (
    <div>
      <Addaccount
        orgid={orgid}
        error={error}
        accountTypes={accountTypes}
        branchTypes={branchTypes}
        countries={countries}
        states={states}
      />
    </div>
  );
}