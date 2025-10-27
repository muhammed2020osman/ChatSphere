import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { parseFormData, validateFileType, validateFileSize } from "@/lib/file-upload-helpers";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { file, fields } = await parseFormData(request);
    
    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }
    
    if (!validateFileType(file)) {
      return NextResponse.json({ 
        message: "Invalid file type. Only PDF, PNG, and JPG files are allowed." 
      }, { status: 400 });
    }
    
    if (!validateFileSize(file)) {
      return NextResponse.json({ 
        message: "File too large. Maximum size is 50MB." 
      }, { status: 400 });
    }
    
    const uploadResult = await storage.uploadDrawingManual(file, fields, user.id);
    return NextResponse.json(uploadResult);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    console.error("Error uploading file:", error);
    return createErrorResponse("Failed to upload file");
  }
}


