import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const revisions = await storage.getDrawingRevisions(params.id);
    return NextResponse.json(revisions);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching revisions:", error);
    return createErrorResponse("Failed to fetch revisions");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { description, version } = body;
    
    if (!description) {
      return NextResponse.json({ message: "Description is required" }, { status: 400 });
    }
    
    const revision = await storage.createDrawingRevision(params.id, {
      description,
      version,
      createdBy: user.id,
    });
    
    return NextResponse.json(revision);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating revision:", error);
    return createErrorResponse("Failed to create revision");
  }
}


