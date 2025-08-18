import AddProjectAssignment from '@/app/components/Project_Assignment/AddProjectAssignment';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in .env

  let orgId = '';
  let billTypes=[];
  let otBillType=[];
  let payTerms=[];
  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : '';
    } catch (error) {
      console.error('Invalid JWT token:', error);
    }
  }

     try {
     let pool=await DBconnection();
      const [billtyperows]=await pool.query(
        'select id,Name from C_GENERIC_VALUES where g_id=? and orgid=? and isactive=1',
        [7,orgId]
      );
      billTypes=billtyperows;
      
      const [otBillTypes]=await pool.query(
        'select id,Name from C_GENERIC_VALUES where g_id=? and orgid=? and isactive=1',
        [8,orgId]
      );
      otBillType=otBillTypes;

      const [payTermRows]=await pool.query(
        'select id,Name FROM C_GENERIC_VALUES where g_id=? and orgid=? and isactive=1',
        [9,orgId]
      )
    payTerms=payTermRows;
     } catch (error) {
      console.log('error fetching generic values',error)
     }
  return (
    <div>
      <AddProjectAssignment
       orgId={orgId} 
       billTypes={billTypes}
       otBillType={otBillType}
       payTerms={payTerms}/>
    </div>
  );
};

export default page;