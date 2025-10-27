import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = await request.json();
    
    const updatedLayer = await storage.updateLayerVisibility(params.id, body.visible);
    return NextResponse.json(updatedLayer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating layer visibility:", error);
    return createErrorResponse("Failed to update layer visibility");
  }
}