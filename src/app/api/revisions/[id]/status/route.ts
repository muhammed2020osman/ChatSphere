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
    const { status } = body;
    
    if (!status) {
      return NextResponse.json({ message: "Status is required" }, { status: 400 });
    }
    
    const revision = await storage.updateRevisionStatus(params.id, status, user.id);
    
    return NextResponse.json(revision);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating revision status:", error);
    return createErrorResponse("Failed to update revision status");
  }
}




