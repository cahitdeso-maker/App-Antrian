import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  
  // Clear the session cookie
  response.cookies.set('better-auth.session_token', '', {
    maxAge: 0,
    path: '/',
  });
  
  return response;
}
