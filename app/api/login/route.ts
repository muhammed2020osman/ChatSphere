import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // For local development, create a mock user session
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating development user session');
      
      // Redirect to home page after successful login
      const response = NextResponse.redirect(new URL('/home', request.url));
      
      // Set a simple session cookie for development
      response.cookies.set('dev-session', 'dev-user-123', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 // 24 hours
      });
      
      return response;
    }
    
    // For production, redirect to NextAuth signin
    return NextResponse.redirect(new URL('/api/auth/signin', request.url));
  } catch (error) {
    console.error("Error in login route:", error);
    return NextResponse.json({ message: "Login failed" }, { status: 500 });
  }
}
