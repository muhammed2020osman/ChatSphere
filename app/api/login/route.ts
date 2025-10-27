import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating development user session');
      
      // Create or update user in database
      const mockUser = {
        id: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Development User',
        profileImageUrl: null,
        role: 'admin'
      };
      
      const user = await storage.upsertUser(mockUser);
      console.log('User created/updated:', user);
      
      // Redirect to home page
      const response = NextResponse.redirect(new URL('/home', request.url));
      
      // Set session cookie
      const isProduction = process.env.NODE_ENV === 'production';
      response.cookies.set('dev-session', user.id, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60
      });
      
      return response;
    }
    
    return NextResponse.redirect(new URL('/api/auth/signin', request.url));
  } catch (error) {
    console.error("Error in login route:", error);
    return NextResponse.json({ message: "Login failed" }, { status: 500 });
  }
}
