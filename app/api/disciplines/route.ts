import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const disciplines = await storage.getDisciplines();
    return NextResponse.json(disciplines);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    console.error("Error fetching disciplines:", error);
    return createErrorResponse("Failed to fetch disciplines from database");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }
    
    const discipline = await storage.createDiscipline(body);
    return NextResponse.json(discipline);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    console.error("Error creating discipline:", error);
    return createErrorResponse("Failed to create discipline");
  }
}

