import { NextResponse } from 'next/server';

export async function POST(request) {
  console.log(`[logoutAction] Initiating logout at ${new Date().toISOString()}`);
  const cookieStore = await import('next/headers').then(mod => mod.cookies());
  cookieStore.delete("jwt_token");
  console.log("[logoutAction] JWT token cookie deleted successfully");

  // Use a fully qualified URL for development
  const redirectUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/login'
    : 'https://yourdomain.com/login'; // Replace with your production URL

  return NextResponse.redirect(redirectUrl);
}