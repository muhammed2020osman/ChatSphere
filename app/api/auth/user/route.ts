import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, createAuthErrorResponse } from "@/lib/auth-helpers";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user) {
      return createAuthErrorResponse();
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return createAuthErrorResponse();
  }
}

