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
    
    const layers = await storage.getDrawingLayers(drawingId);
    return NextResponse.json(layers);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching layers:", error);
    return createErrorResponse("Failed to fetch layers");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const layer = await storage.createLayer({
      ...body,
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