import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Clear the development session cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    
    // Remove the session cookie
    response.cookies.set('dev-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    });
    
    return response;
  } catch (error) {
    console.error("Error in logout route:", error);
    return NextResponse.json({ message: "Logout failed" }, { status: 500 });
  }
}



