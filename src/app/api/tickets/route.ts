import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assignedTo");
    
    const tickets = await storage.getTickets({
      status,
      priority,
      assignedTo,
    });
    
    return NextResponse.json(tickets);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching tickets:", error);
    return createErrorResponse("Failed to fetch tickets");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { drawingId, title, description, priority, assignedTo } = body;
    
    if (!drawingId || !title) {
      return NextResponse.json({ 
        message: "Drawing ID and title are required" 
      }, { status: 400 });
    }
    
    const ticket = await storage.createTicket({
      drawingId,
      title,
      description,
      priority: priority || 'medium',
      assignedTo,
      createdBy: user.id,
    });
    
    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating ticket:", error);
    return createErrorResponse("Failed to create ticket");
  }
}




