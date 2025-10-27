import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { objectPath: string[] } }
) {
  try {
    await requireAuth();
    
    const objectPath = params.objectPath.join('/');
    
    const fileBuffer = await storage.getObject(objectPath);
    
    if (!fileBuffer) {
      return NextResponse.json({ message: "Object not found" }, { status: 404 });
    }
    
    // Determine content type based on file extension
    const extension = objectPath.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (extension) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error fetching object:", error);
    return createErrorResponse("Failed to fetch object");
  }
}


