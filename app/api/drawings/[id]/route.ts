import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const drawing = await storage.getDrawing(params.id);
    if (!drawing) {
      return NextResponse.json({ message: "Drawing not found" }, { status: 404 });
    }
    
    return NextResponse.json(drawing);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching drawing:", error);
    return createErrorResponse("Failed to fetch drawing");
  }
}

