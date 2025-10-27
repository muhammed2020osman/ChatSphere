import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const notifications = await storage.getNotifications(user.id);
    
    return NextResponse.json(notifications);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching notifications:", error);
    return createErrorResponse("Failed to fetch notifications");
  }
}