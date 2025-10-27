import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    
    const body = await request.json();
    const { status } = body;
    
    if (!status) {
      return NextResponse.json({ message: "Status is required" }, { status: 400 });
    }
    
    const ticket = await storage.updateTicketStatus(params.id, status);
    
    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating ticket status:", error);
    return createErrorResponse("Failed to update ticket status");
  }
}


