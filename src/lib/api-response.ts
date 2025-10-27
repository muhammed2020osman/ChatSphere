import { NextResponse } from "next/server";

/**
 * Standard API response helpers
 */
export class ApiResponse {
  static success(data: any, status: number = 200) {
    return NextResponse.json(data, { status });
  }

  static error(message: string, status: number = 500) {
    return NextResponse.json({ message }, { status });
  }

  static unauthorized(message: string = "Unauthorized") {
    return NextResponse.json({ message }, { status: 401 });
  }

  static forbidden(message: string = "Forbidden") {
    return NextResponse.json({ message }, { status: 403 });
  }

  static notFound(message: string = "Not Found") {
    return NextResponse.json({ message }, { status: 404 });
  }

  static badRequest(message: string = "Bad Request") {
    return NextResponse.json({ message }, { status: 400 });
  }

  static created(data: any) {
    return NextResponse.json(data, { status: 201 });
  }

  static noContent() {
    return new NextResponse(null, { status: 204 });
  }
}

