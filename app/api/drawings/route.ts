import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    
    // Mock data for testing purposes
    const mockDrawings = {
      drawings: [
        {
          id: "1",
          name: "Architectural Plan - Floor 1",
          title: "Architectural Plan - Floor 1",
          sheetNo: "A-001",
          building: "Tower A",
          floor: "Ground Floor",
          discipline: "Architectural",
          status: "approved",
          revisionCount: 2,
          data: JSON.stringify({ sheetNo: "A-001" }),
          latestRevision: {
            id: "1",
            revisionNo: "Rev 2",
            status: "approved",
            uploadedAt: new Date().toISOString(),
            uploadMethod: "ai",
            thumbnailUrl: null
          },
          discipline: { id: "arch", name: "Architectural" },
          floor: { id: "ground", name: "Ground Floor" }
        },
        {
          id: "2", 
          name: "Structural Plan - Foundation",
          title: "Structural Plan - Foundation",
          sheetNo: "S-001",
          building: "Tower A",
          floor: "Foundation",
          discipline: "Structural",
          status: "under_review",
          revisionCount: 1,
          data: JSON.stringify({ sheetNo: "S-001" }),
          latestRevision: {
            id: "2",
            revisionNo: "Rev 1", 
            status: "under_review",
            uploadedAt: new Date(Date.now() - 86400000).toISOString(),
            uploadMethod: "manual",
            thumbnailUrl: null
          },
          discipline: { id: "struct", name: "Structural" },
          floor: { id: "foundation", name: "Foundation" }
        },
        {
          id: "3",
          name: "MEP Plan - Electrical",
          title: "MEP Plan - Electrical",
          sheetNo: "M-001", 
          building: "Tower B",
          floor: "Floor 1",
          discipline: "MEP",
          status: "draft",
          revisionCount: 3,
          data: JSON.stringify({ sheetNo: "M-001" }),
          latestRevision: {
            id: "3",
            revisionNo: "Rev 3",
            status: "draft", 
            uploadedAt: new Date(Date.now() - 172800000).toISOString(),
            uploadMethod: "ai",
            thumbnailUrl: null
          },
          discipline: { id: "mep", name: "MEP" },
          floor: { id: "floor1", name: "Floor 1" }
        }
      ],
      total: 3,
      page: page,
      limit: limit,
      totalPages: Math.ceil(3 / limit)
    };

    return NextResponse.json(mockDrawings);
  } catch (error) {
    console.error("Error fetching drawings:", error);
    return NextResponse.json({ message: "Failed to fetch drawings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, building, floor, discipline, status } = body;

    if (!fileName) {
      return NextResponse.json({ message: "File name is required" }, { status: 400 });
    }

    // Mock response for testing
    const mockUpdatedDrawing = {
      id: "mock-id",
      fileName,
      building,
      floor,
      discipline,
      status,
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json(mockUpdatedDrawing);
  } catch (error) {
    console.error("Error updating drawing:", error);
    return NextResponse.json({ message: "Failed to update drawing" }, { status: 500 });
  }
}
