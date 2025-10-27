import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const channelsList = await storage.getChannels();
    return NextResponse.json(channelsList);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching channels:", error);
    return createErrorResponse("Failed to fetch channels");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { name, description, isPrivate } = body;

    if (!name) {
      return NextResponse.json({ message: "Channel name is required" }, { status: 400 });
    }

    const newChannel = await storage.createChannel({
      name,
      description,
      isPrivate: isPrivate || false,
      createdBy: user.id,
    });

    return NextResponse.json(newChannel, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error creating channel:", error);
    return createErrorResponse("Failed to create channel");
  }
}
