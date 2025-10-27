import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    await storage.markAllNotificationsAsRead(user.id);
    
    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error marking all notifications as read:", error);
    return createErrorResponse("Failed to mark all notifications as read");
  }
}




