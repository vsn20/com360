export const dynamic = 'force-dynamic';
import React from 'react';
import AssignSurvey from '@/app/components/Surveys/AssignSurvey/AssignSurvey';
import { getAssignData } from '@/app/serverActions/Surveys/AssignSurvey/Assignsurvey';

export default async function AssignPage() {
  const data = await getAssignData();

  if (data.error) {
    return <div className="p-4 text-red-500">Error: {data.error}</div>;
  }

  return (
    <div className="roles-overview-container">
      <AssignSurvey 
        surveys={data.surveys}
        employees={data.employees}
        currentUser={data.currentUser}
      />
    </div>
  );
}