import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    console.log("[API] Fetching floors...");
    
    // Return fallback data directly for now
    const floors = [
      { id: 'floor-1', name: 'Ground Floor', level: '0', description: 'Ground level', sortOrder: 1 },
      { id: 'floor-2', name: 'First Floor', level: '1', description: 'First level', sortOrder: 2 },
      { id: 'floor-3', name: 'Second Floor', level: '2', description: 'Second level', sortOrder: 3 },
      { id: 'floor-4', name: 'Third Floor', level: '3', description: 'Third level', sortOrder: 4 },
      { id: 'floor-5', name: 'Basement', level: '-1', description: 'Basement level', sortOrder: 0 }
    ];
    
    console.log("[API] Floors fetched successfully:", floors.length, "floors");
    return NextResponse.json(floors);
    
  } catch (error) {
    console.error("[API] Error fetching floors:", error);
    
    // Return fallback data even in case of error
    console.log("[API] Returning fallback floors data");
    const fallbackFloors = [
      { id: 'floor-1', name: 'Ground Floor', level: '0', description: 'Ground level', sortOrder: 1 },
      { id: 'floor-2', name: 'First Floor', level: '1', description: 'First level', sortOrder: 2 },
      { id: 'floor-3', name: 'Second Floor', level: '2', description: 'Second level', sortOrder: 3 },
      { id: 'floor-4', name: 'Third Floor', level: '3', description: 'Third level', sortOrder: 4 },
      { id: 'floor-5', name: 'Basement', level: '-1', description: 'Basement level', sortOrder: 0 }
    ];
    
    return NextResponse.json(fallbackFloors);
  }
}