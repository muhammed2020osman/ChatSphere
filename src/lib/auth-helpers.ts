import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export interface AuthenticatedUser {
  id: string;
  name?: string;
  email?: string;
  image?: string;
}

/**
 * Get authenticated user from NextAuth session or development cookie
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  // Check for development session cookie first
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devSession = cookieStore.get('dev-session');
    
    if (devSession?.value === 'dev-user-123') {
      return {
        id: 'dev-user-123',
        name: 'Development User',
        email: 'dev@localhost.com',
        image: null,
      };
    }
  }
  
  // Fall back to NextAuth session
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user?.id) {
    return null;
  }
  
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }
  
  return user;
}

/**
 * Create error response for authentication failures
 */
export function createAuthErrorResponse(message: string = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401 });
}

/**
 * Create error response for server errors
 */
export function createErrorResponse(message: string, status: number = 500) {
  return NextResponse.json({ message }, { status });
}

/**
 * Create success response
 */
export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}

