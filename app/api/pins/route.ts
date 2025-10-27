import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { drawingId, x, y, title, description, color } = body;
    
    if (!drawingId || typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json({ 
        message: "Drawing ID, x, and y coordinates are required" 
      }, { status: 400 });
    }
    
    const pin = await storage.createPin({
      drawingId,
      x,
      y,
      title,
      description,
      color,
      createdBy: user.id,
    });
    
    return NextResponse.json(pin);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating pin:", error);
    return createErrorResponse("Failed to create pin");
  }
}


