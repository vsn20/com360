import { cookies } from 'next/headers';
import { getMenusWithPriorities, savePriorities } from '@/app/serverActions/priorityAction';
import PrioritySettingClient from './PrioritySettingClient';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export default async function PrioritySettingPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = token ? decodeJwt(token) : null;
  const orgid = decoded?.orgid || null;

  if (!orgid) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <p>Error: No organization ID found. Please log in again.</p>
      </div>
    );
  }

  const { success, menus, error } = await getMenusWithPriorities();
  
  if (!success) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', marginLeft: '200px' }}>
      <PrioritySettingClient 
        initialMenus={menus} 
        orgid={orgid}
      />
    </div>
  );
}