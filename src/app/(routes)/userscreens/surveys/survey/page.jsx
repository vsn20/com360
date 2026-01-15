import React from 'react';
import Surveys from '@/app/components/Surveys/Surveys/Surveys';
import { getAssignedSurveys } from '@/app/serverActions/Surveys/Survey/Assignedsurvey';

const Page = async () => {
  // Fetch data on the server
  const data = await getAssignedSurveys();

  // Handle potential errors
  if (data.error) {
    return <div className="p-4 text-red-500">Error: {data.error}</div>;
  }

  // Pass data to Client Component
  // JSON.parse/stringify is used to ensure Dates are serialized correctly
  return (
    <div>
      <Surveys 
        initialSurveys={JSON.parse(JSON.stringify(data.surveys))} 
        currentUser={data.currentUser}
      />
    </div>
  );
};

export default Page;