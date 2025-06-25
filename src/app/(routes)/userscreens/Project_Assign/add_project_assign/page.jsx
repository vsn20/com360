import AddProjectAssignment from '@/app/components/Project_Assignment/AddProjectAssignment';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in .env

  let orgId = '';
  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : '';
    } catch (error) {
      console.error('Invalid JWT token:', error);
    }
  }

  return (
    <div>
      <AddProjectAssignment orgId={orgId} />
    </div>
  );
};

export default page;