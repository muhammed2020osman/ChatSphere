import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    // For now, return empty array since pages functionality might not be fully implemented
    // In a real implementation, this would call storage.getRevisionPages(params.id)
    return NextResponse.json([]);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching revision pages:", error);
    return createErrorResponse("Failed to fetch revision pages");
  }
}