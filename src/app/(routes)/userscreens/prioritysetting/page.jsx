import PrioritySetting from "@/app/components/PrioritySetting";
import { cookies } from 'next/headers';
import { getAllFeatures } from "@/app/serverActions/getAllFeatures";

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

export default async function Page() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = token ? decodeJwt(token) : null;
  const orgid = decoded?.orgid || null;

  const { success, features, error } = await getAllFeatures();
  if (!success) {
    throw new Error(error || 'Failed to fetch features');
  }

  return (
    <div style={{ padding: '20px', marginLeft: '200px' }}>
      <h1>Priority Setting</h1>
      <PrioritySetting features={features} orgid={orgid} token={token} />
    </div>
  );
}