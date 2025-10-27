import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const channel = await storage.getChannel(params.id);
    if (!channel) {
      return NextResponse.json({ message: "Channel not found" }, { status: 404 });
    }
    
    return NextResponse.json(channel);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching channel:", error);
    return createErrorResponse("Failed to fetch channel");
  }
}



