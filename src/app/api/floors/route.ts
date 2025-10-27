import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    console.log("[API] Fetching floors from database...");
    const floors = await storage.getFloors();
    console.log("[API] Floors fetched successfully:", floors.length, "floors");
    return NextResponse.json(floors);
  } catch (error) {
    console.error("[API] Error fetching floors:", error);
    return createErrorResponse("Failed to fetch floors from database");
  }
}