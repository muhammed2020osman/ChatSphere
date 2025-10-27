import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Mock data for testing purposes
    const mockFloors = [
      {
        id: "ground",
        name: "Ground Floor",
        building: "Tower A",
        level: 0
      },
      {
        id: "foundation",
        name: "Foundation",
        building: "Tower A", 
        level: -1
      },
      {
        id: "floor1",
        name: "Floor 1",
        building: "Tower A",
        level: 1
      },
      {
        id: "floor2",
        name: "Floor 2",
        building: "Tower A",
        level: 2
      },
      {
        id: "floor3",
        name: "Floor 3",
        building: "Tower A",
        level: 3
      },
      {
        id: "ground-b",
        name: "Ground Floor",
        building: "Tower B",
        level: 0
      },
      {
        id: "floor1-b",
        name: "Floor 1",
        building: "Tower B",
        level: 1
      },
      {
        id: "floor2-b",
        name: "Floor 2",
        building: "Tower B",
        level: 2
      }
    ];

    return NextResponse.json(mockFloors);
  } catch (error) {
    console.error("Error fetching floors:", error);
    return NextResponse.json({ message: "Failed to fetch floors" }, { status: 500 });
  }
}

