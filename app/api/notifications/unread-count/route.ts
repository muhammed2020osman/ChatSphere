import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const count = await storage.getUnreadNotificationCount(user.id);
    
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching unread count:", error);
    return createErrorResponse("Failed to fetch unread count");
  }
}




