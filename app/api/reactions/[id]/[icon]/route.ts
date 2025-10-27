import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; icon: string } }
) {
  try {
    const user = await requireAuth();
    
    await storage.removeReaction(params.id, params.icon, user.id);
    
    return NextResponse.json({ message: "Reaction removed successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error removing reaction:", error);
    return createErrorResponse("Failed to remove reaction");
  }
}

