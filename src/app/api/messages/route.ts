import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!channelId) {
      return NextResponse.json({ message: "Channel ID is required" }, { status: 400 });
    }

    const messagesList = await storage.getChannelMessages(channelId, { limit });
    return NextResponse.json(messagesList);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching messages:", error);
    return createErrorResponse("Failed to fetch messages");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { content, channelId } = body;

    if (!content || !channelId) {
      return NextResponse.json({ 
        message: "Content and channel ID are required" 
      }, { status: 400 });
    }

    const newMessage = await storage.createMessage({
      content,
      channelId,
      userId: user.id,
    });

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating message:", error);
    return createErrorResponse("Failed to create message");
  }
}
