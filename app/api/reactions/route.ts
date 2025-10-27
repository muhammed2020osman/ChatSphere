import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { messageId, icon } = body;
    
    if (!messageId || !icon) {
      return NextResponse.json({ 
        message: "Message ID and icon are required" 
      }, { status: 400 });
    }
    
    const reaction = await storage.addReaction({
      messageId,
      userId: user.id,
      icon,
    });
    
    return NextResponse.json(reaction, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error adding reaction:", error);
    return createErrorResponse("Failed to add reaction");
  }
}




