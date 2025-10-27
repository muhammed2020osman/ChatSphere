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
    const { visible } = body;
    
    if (typeof visible !== 'boolean') {
      return NextResponse.json({ message: "Visible must be a boolean" }, { status: 400 });
    }
    
    const layer = await storage.updateLayerVisibility(params.id, visible);
    
    return NextResponse.json(layer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating layer visibility:", error);
    return createErrorResponse("Failed to update layer visibility");
  }
}


