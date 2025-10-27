import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await requireAuth();
    
    const messages = await storage.getDirectMessages(user.id, params.userId);
    
    return NextResponse.json(messages);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching direct messages:", error);
    return createErrorResponse("Failed to fetch direct messages");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { content } = body;
    
    if (!content) {
      return NextResponse.json({ message: "Content is required" }, { status: 400 });
    }
    
    const message = await storage.createDirectMessage({
      content,
      senderId: user.id,
      recipientId: params.userId,
    });
    
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating direct message:", error);
    return createErrorResponse("Failed to create direct message");
  }
}




