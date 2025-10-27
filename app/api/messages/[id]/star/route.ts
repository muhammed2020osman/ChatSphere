import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    const starredMessage = await storage.starMessage(params.id, user.id);
    
    return NextResponse.json(starredMessage);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error starring message:", error);
    return createErrorResponse("Failed to star message");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    await storage.unstarMessage(params.id, user.id);
    
    return NextResponse.json({ message: "Message unstarred successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error unstarring message:", error);
    return createErrorResponse("Failed to unstar message");
  }
}



