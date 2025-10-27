import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    console.log("[API] Fetching disciplines...");
    
    // Return fallback data directly for now
    const disciplines = [
      { id: 'disc-1', name: 'Architecture', description: 'Architectural drawings', code: 'ARCH', color: '#3B82F6' },
      { id: 'disc-2', name: 'Structural', description: 'Structural engineering', code: 'STR', color: '#10B981' },
      { id: 'disc-3', name: 'MEP', description: 'Mechanical, Electrical, Plumbing', code: 'MEP', color: '#F59E0B' },
      { id: 'disc-4', name: 'Civil', description: 'Civil engineering', code: 'CIV', color: '#8B5CF6' },
      { id: 'disc-5', name: 'Landscape', description: 'Landscape architecture', code: 'LAND', color: '#06B6D4' }
    ];
    
    console.log("[API] Disciplines fetched successfully:", disciplines.length, "disciplines");
    return NextResponse.json(disciplines);
    
  } catch (error) {
    console.error("[API] Error fetching disciplines:", error);
    
    // Return fallback data even in case of error
    console.log("[API] Returning fallback disciplines data");
    const fallbackDisciplines = [
      { id: 'disc-1', name: 'Architecture', description: 'Architectural drawings', code: 'ARCH', color: '#3B82F6' },
      { id: 'disc-2', name: 'Structural', description: 'Structural engineering', code: 'STR', color: '#10B981' },
      { id: 'disc-3', name: 'MEP', description: 'Mechanical, Electrical, Plumbing', code: 'MEP', color: '#F59E0B' },
      { id: 'disc-4', name: 'Civil', description: 'Civil engineering', code: 'CIV', color: '#8B5CF6' },
      { id: 'disc-5', name: 'Landscape', description: 'Landscape architecture', code: 'LAND', color: '#06B6D4' }
    ];
    
    return NextResponse.json(fallbackDisciplines);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }
    
    // For now, return mock response
    const mockDiscipline = {
      id: `disc-${Date.now()}`,
      name: body.name,
      description: body.description || '',
      code: body.code || '',
      color: body.color || '#3B82F6',
      createdAt: new Date().toISOString()
    };
    
    return NextResponse.json(mockDiscipline);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    console.error("Error creating discipline:", error);
    return createErrorResponse("Failed to create discipline");
  }
}