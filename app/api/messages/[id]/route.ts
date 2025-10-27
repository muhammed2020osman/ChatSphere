import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { content } = body;
    
    if (!content) {
      return NextResponse.json({ message: "Content is required" }, { status: 400 });
    }
    
    const message = await storage.updateMessage(params.id, content);
    
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating message:", error);
    return createErrorResponse("Failed to update message");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    await storage.deleteMessage(params.id);
    
    return NextResponse.json({ message: "Message deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error deleting message:", error);
    return createErrorResponse("Failed to delete message");
  }
}




