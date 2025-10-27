import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const correctCode = process.env.ACCESS_CODE;

    if (!correctCode) {
      return NextResponse.json(
        { message: "Access code not configured" },
        { status: 500 }
      );
    }

    if (code === correctCode) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { message: "Invalid access code" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error verifying access code:", error);
    return NextResponse.json(
      { message: "Failed to verify access code" },
      { status: 500 }
    );
  }
}

