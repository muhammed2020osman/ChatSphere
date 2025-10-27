import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Mock file upload response for testing purposes
    const mockUploadResult = {
      id: `drawing-${Date.now()}`,
      fileName: "mock-drawing.pdf",
      title: "Mock Drawing Upload",
      sheetNo: "MOCK-001",
      building: "Tower A",
      floor: "Ground Floor",
      discipline: "Architectural",
      status: "draft",
      uploadedBy: "dev-user-123",
      uploadedAt: new Date().toISOString(),
      fileSize: 1024000, // 1MB
      fileType: "application/pdf",
      uploadMethod: "manual",
      message: "File uploaded successfully (mock response)"
    };

    return NextResponse.json(mockUploadResult);
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ message: "Failed to upload file" }, { status: 500 });
  }
}


