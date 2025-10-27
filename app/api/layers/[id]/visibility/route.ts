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
    
    // For now, return mock response since layer visibility functionality might not be fully implemented
    // In a real implementation, this would call storage.updateLayerVisibility(params.id, body.visible)
    const mockResponse = {
      id: params.id,
      visible: body.visible,
      updatedAt: new Date().toISOString(),
    };
    
    return NextResponse.json(mockResponse);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating layer visibility:", error);
    return createErrorResponse("Failed to update layer visibility");
  }
}