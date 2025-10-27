import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const drawingId = searchParams.get("drawingId");
    
    if (!drawingId) {
      return NextResponse.json({ message: "Drawing ID is required" }, { status: 400 });
    }
    
    const pins = await storage.getDrawingPins(drawingId);
    return NextResponse.json(pins);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching pins:", error);
    return createErrorResponse("Failed to fetch pins");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const pin = await storage.createPin({
      ...body,
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