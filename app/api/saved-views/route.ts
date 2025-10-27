import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const savedViews = await storage.getSavedViews(user.id);
    return NextResponse.json(savedViews);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching saved views:", error);
    return createErrorResponse("Failed to fetch saved views");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { drawingId, name, viewState, filters } = body;
    
    if (!drawingId || !name) {
      return NextResponse.json({ 
        message: "Drawing ID and name are required" 
      }, { status: 400 });
    }
    
    const savedView = await storage.createSavedView({
      drawingId,
      name,
      viewState,
      filters,
      createdBy: user.id,
    });
    
    return NextResponse.json(savedView);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating saved view:", error);
    return createErrorResponse("Failed to create saved view");
  }
}




