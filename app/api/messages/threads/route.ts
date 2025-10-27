import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const parentMessageId = searchParams.get("parentMessageId");
    
    if (!channelId || !parentMessageId) {
      return NextResponse.json({ 
        message: "Channel ID and parent message ID are required" 
      }, { status: 400 });
    }
    
    const threads = await storage.getMessageThreads(channelId, parentMessageId);
    
    return NextResponse.json(threads);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching message threads:", error);
    return createErrorResponse("Failed to fetch message threads");
  }
}




