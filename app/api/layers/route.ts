import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    // For now, return empty array since layers functionality might not be fully implemented
    // In a real implementation, this would call storage.getAllLayers()
    return NextResponse.json([]);
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
    
    // For now, return mock response since layers functionality might not be fully implemented
    // In a real implementation, this would call storage.createLayer(body)
    const mockLayer = {
      id: `layer-${Date.now()}`,
      ...body,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    
    return NextResponse.json(mockLayer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating layer:", error);
    return createErrorResponse("Failed to create layer");
  }
}