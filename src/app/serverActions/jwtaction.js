import { cookies } from "next/headers";

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

export async function jwtaction() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  console.log('Server-side JWT token:', token);

  const userData = token ? decodeJwt(token) : null;
  const username = userData?.username || userData?.sub || 'Unknown';
  const rolename = userData?.rolename || userData?.role || 'Unknown';
  const orgName = userData?.orgname || userData?.orgid || 'Unknown';
  const logoLetter = orgName[0] ? orgName[0].toUpperCase() : 'M';

  console.log('Decoded user data:', { username, rolename, orgName, logoLetter });

  return { username, rolename, orgName, logoLetter };
}