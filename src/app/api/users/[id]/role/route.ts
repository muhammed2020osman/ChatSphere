import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAuth();
    
    // Check if current user is admin (you might want to implement this check)
    // For now, we'll allow any authenticated user to change roles
    
    const body = await request.json();
    const { role } = body;
    
    if (!role) {
      return NextResponse.json({ message: "Role is required" }, { status: 400 });
    }
    
    const updatedUser = await storage.updateUserRole(params.id, role);
    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error updating user role:", error);
    return createErrorResponse("Failed to update user role");
  }
}

