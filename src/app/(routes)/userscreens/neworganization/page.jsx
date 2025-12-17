import React from 'react'
import NewOrganization from '@/app/components/NewOrganization/NewOrganization'
import { fetchRequests } from '@/app/serverActions/NewOrganizations/FetchNewOrganization'

export const dynamic = 'force-dynamic';

const page = async () => {
  const initialRequests = await fetchRequests();

  return (
    <div>
      <NewOrganization initialRequests={initialRequests} />
    </div>
  )
}

export default page