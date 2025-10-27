import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Mock data for testing purposes
    const mockDisciplines = [
      {
        id: "arch",
        name: "Architectural",
        description: "Architectural drawings and plans"
      },
      {
        id: "struct",
        name: "Structural",
        description: "Structural engineering drawings"
      },
      {
        id: "mep",
        name: "MEP",
        description: "Mechanical, Electrical, and Plumbing"
      },
      {
        id: "civil",
        name: "Civil",
        description: "Civil engineering and site plans"
      },
      {
        id: "landscape",
        name: "Landscape",
        description: "Landscape architecture and design"
      }
    ];

    return NextResponse.json(mockDisciplines);
  } catch (error) {
    console.error("Error fetching disciplines:", error);
    return NextResponse.json({ message: "Failed to fetch disciplines" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    
    if (!name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }
    
    // Mock response for testing
    const mockDiscipline = {
      id: `mock-${Date.now()}`,
      name,
      description: description || "",
      createdAt: new Date().toISOString()
    };

    return NextResponse.json(mockDiscipline);
  } catch (error) {
    console.error("Error creating discipline:", error);
    return NextResponse.json({ message: "Failed to create discipline" }, { status: 500 });
  }
}

