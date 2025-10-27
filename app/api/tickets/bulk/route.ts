import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    
    const body = await request.json();
    const { ticketIds, updates } = body;
    
    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ 
        message: "Ticket IDs array is required" 
      }, { status: 400 });
    }
    
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ 
        message: "Updates object is required" 
      }, { status: 400 });
    }
    
    const updatedTickets = await storage.bulkUpdateTickets(ticketIds, updates);
    
    return NextResponse.json(updatedTickets);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error bulk updating tickets:", error);
    return createErrorResponse("Failed to bulk update tickets");
  }
}


