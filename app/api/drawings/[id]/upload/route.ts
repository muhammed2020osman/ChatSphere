import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Mock file upload response for testing purposes
    const mockUploadResult = {
      id: params.id,
      fileName: "mock-revision.pdf",
      title: "Mock Revision Upload",
      sheetNo: "MOCK-002",
      revisionNo: "Rev 1",
      status: "draft",
      uploadedBy: "dev-user-123",
      uploadedAt: new Date().toISOString(),
      fileSize: 2048000, // 2MB
      fileType: "application/pdf",
      uploadMethod: "manual",
      message: "File uploaded successfully (mock response)",
      drawingId: params.id
    };

    return NextResponse.json(mockUploadResult);
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ message: "Failed to upload file" }, { status: 500 });
  }
}


