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

    const fileName = `${Date.now()}-${file.fileName}`;
    const uploadResult = await storage.uploadObject(fileName, file.buffer, file.fileType);

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      fileName: file.fileName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error uploading object:", error);
    return createErrorResponse("Failed to upload object");
  }
}


