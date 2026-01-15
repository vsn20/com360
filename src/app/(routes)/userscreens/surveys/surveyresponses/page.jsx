import React from 'react';
import SurveyResponses from '@/app/components/Surveys/SurveyResponses/SurveyResponses';
import { getCreatorSurveys } from '@/app/serverActions/Surveys/SurveyResponses/Responses';

const Page = async () => {
  // Fetch initial list server-side
  const data = await getCreatorSurveys();

  if (data.error) {
    return <div className="p-4 text-red-500">Error: {data.error}</div>;
  }

  return (
    <div>
      <SurveyResponses 
        initialSurveys={JSON.parse(JSON.stringify(data.surveys))} 
      />
    </div>
  );
};

export default Page;