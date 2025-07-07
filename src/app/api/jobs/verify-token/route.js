import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token missing' }, { status: 400 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return NextResponse.json({ success: true, user: decoded }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }
}
