import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const floors = await storage.getFloors();
    return NextResponse.json(floors);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    console.error("Error fetching floors:", error);
    return createErrorResponse("Failed to fetch floors from database");
  }
}

