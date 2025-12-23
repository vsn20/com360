export const dynamic = 'force-dynamic';
import React from 'react';
import H1BReg from '@/app/components/Immigration/H1B_Registration/H1BReg';
import { 
  fetchH1BRegistrations, 
  fetchH1BSuborgs,
  fetchCountries // Import this
} from '@/app/serverActions/Immigration/H1Bimmigration/H1Bimmigration';

const H1BImmigrationPage = async () => {
  let initialRecords = [];
  let suborgs = [];
  let countries = [];
  let error = null;

  try {
    // Parallel Fetch for performance
    const [recordsData, suborgsData, countriesData] = await Promise.all([
      fetchH1BRegistrations(), 
      fetchH1BSuborgs(),
      fetchCountries() // Fetch countries here
    ]);
    initialRecords = recordsData;
    suborgs = suborgsData;
    countries = countriesData;
  } catch (err) {
    console.error("Error loading H1B data:", err);
    error = err.message;
  }

  if (error) {
    return <div style={{padding: 20, color: 'red'}}>Error loading page: {error}</div>;
  }

  return (
    <H1BReg 
      initialRecords={initialRecords} 
      suborgs={suborgs} 
      countries={countries} // Pass to client component
    />
  );
};

export default H1BImmigrationPage;