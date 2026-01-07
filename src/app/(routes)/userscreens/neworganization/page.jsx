import React from 'react'
import NewOrganization from '@/app/components/NewOrganization/NewOrganization'
import { fetchRequests, fetchExistingOrganizations } from '@/app/serverActions/NewOrganizations/FetchNewOrganization'

export const dynamic = 'force-dynamic';

const page = async () => {
  const initialRequests = await fetchRequests();
  const initialOrganizations = await fetchExistingOrganizations();

  return (
    <div>
      <NewOrganization initialRequests={initialRequests} initialOrganizations={initialOrganizations} />
    </div>
  )
}

export default page