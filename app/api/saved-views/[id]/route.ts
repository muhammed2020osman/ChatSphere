import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const savedView = await storage.getSavedView(params.id);
    if (!savedView) {
      return NextResponse.json({ message: "Saved view not found" }, { status: 404 });
    }
    
    return NextResponse.json(savedView);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching saved view:", error);
    return createErrorResponse("Failed to fetch saved view");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { name, viewState, filters } = body;
    
    if (!name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }
    
    const savedView = await storage.updateSavedView(params.id, {
      name,
      viewState,
      filters,
    });
    
    return NextResponse.json(savedView);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating saved view:", error);
    return createErrorResponse("Failed to update saved view");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    await storage.deleteSavedView(params.id);
    
    return NextResponse.json({ message: "Saved view deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error deleting saved view:", error);
    return createErrorResponse("Failed to delete saved view");
  }
}




