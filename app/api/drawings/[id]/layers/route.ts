import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const layers = await storage.getDrawingLayers(params.id);
    return NextResponse.json(layers);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching layers:", error);
    return createErrorResponse("Failed to fetch layers");
  }
}




