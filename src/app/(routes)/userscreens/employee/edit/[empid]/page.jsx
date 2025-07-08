import React from 'react';
import EditEmployee from '@/app/components/Employee/Employee_edit';
import { fetchLeaveTypes } from '@/app/serverActions/Employee/overview';

const Page = async () => {
  let leaveTypes = [];
  try {
    leaveTypes = await fetchLeaveTypes();
  } catch (err) {
    console.error('Error fetching leave types:', err);
    // Proceed without leaveTypes, as it's optional
  }

  return (
    <div>
      <EditEmployee leaveTypes={leaveTypes} />
    </div>
  );
};

export default Page;