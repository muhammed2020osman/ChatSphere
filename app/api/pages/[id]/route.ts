import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const page = await storage.getPage(params.id);
    if (!page) {
      return NextResponse.json({ message: "Page not found" }, { status: 404 });
    }
    
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching page:", error);
    return createErrorResponse("Failed to fetch page");
  }
}


