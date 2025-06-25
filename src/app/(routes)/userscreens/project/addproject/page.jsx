import Addproject from '@/app/components/Project/Addproject';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in .env

  let orgId = null;
  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : null; // Ensure orgId is a string
    } catch (error) {
      console.error('Invalid JWT token:', error);
      orgId = null; // Fallback to null if decoding fails
    }
  }

  return (
    <div>
      <Addproject orgId={orgId} />
    </div>
  );
};

export default page;