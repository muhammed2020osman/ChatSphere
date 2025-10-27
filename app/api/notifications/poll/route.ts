import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const lastTimestamp = searchParams.get("lastTimestamp");

    const newNotifications = await storage.pollNotifications(user.id, {
      lastTimestamp,
    });

    return NextResponse.json({
      notifications: newNotifications,
      hasNewNotifications: newNotifications.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error polling notifications:", error);
    return createErrorResponse("Failed to poll notifications");
  }
}
