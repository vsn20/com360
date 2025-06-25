"use server"; // Marks this file as a server-only module

import DBconnection from "@/app/utils/config/db";

export async function fetchCountryStateData() {
  let connection;
  try {
    connection = await DBconnection();

    // Fetch countries
    const [countryRows] = await connection.execute('SELECT ID, VALUE AS name FROM C_COUNTRY WHERE ACTIVE = 1');
    const countries = countryRows.map(row => ({ id: row.ID, name: row.name }));

    // Fetch states
    const [stateRows] = await connection.execute('SELECT ID, VALUE AS name FROM C_STATE WHERE ACTIVE = 1');
    const states = stateRows.map(row => ({ id: row.ID, name: row.name }));

    return { countries, states };
  } catch (error) {
    console.error('Error fetching country/state data:', error);
    throw new Error('Failed to fetch country/state data');
  } 
}