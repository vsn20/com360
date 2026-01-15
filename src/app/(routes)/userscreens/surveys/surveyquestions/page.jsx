export const dynamic = 'force-dynamic';
import React from 'react';
import SurveyQuestions from '@/app/components/Surveys/SurveyQuestions/SurveyQuestions'; // Make sure this path matches your folder structure
import { getSurveys } from '@/app/serverActions/Surveys/surveyActions';

export default async function SurveysPage() {
  // Fetch data server-side
  const data = await getSurveys();

  if (data.error) {
    return <div className="p-4 text-red-500">Error: {data.error}</div>;
  }

  return (
    <div className="roles-overview-container">
      <SurveyQuestions 
        initialMySurveys={JSON.parse(JSON.stringify(data.mySurveys))} 
        initialOrgSurveys={JSON.parse(JSON.stringify(data.orgSurveys))}
        // FIX: Access currentUser directly from data
        currentUser={data.currentUser} 
      />
    </div>
  );
}