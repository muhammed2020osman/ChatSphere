import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const lastMessageId = searchParams.get("lastMessageId");
    const lastTimestamp = searchParams.get("lastTimestamp");

    if (!channelId) {
      return NextResponse.json({ message: "Channel ID is required" }, { status: 400 });
    }

    const newMessages = await storage.pollMessages(channelId, {
      lastMessageId: lastMessageId || undefined,
      lastTimestamp: lastTimestamp || undefined,
    });

    return NextResponse.json({
      messages: newMessages,
      hasNewMessages: newMessages.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error polling messages:", error);
    return createErrorResponse("Failed to poll messages");
  }
}
