import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { drawingId, name, description, color, visible } = body;
    
    if (!drawingId || !name) {
      return NextResponse.json({ 
        message: "Drawing ID and name are required" 
      }, { status: 400 });
    }
    
    const layer = await storage.createLayer({
      drawingId,
      name,
      description,
      color,
      visible: visible ?? true,
      createdBy: user.id,
    });
    
    return NextResponse.json(layer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating layer:", error);
    return createErrorResponse("Failed to create layer");
  }
}


