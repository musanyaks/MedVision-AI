import { NextResponse } from "next/server";
import { getModelInfo } from "@/lib/onnx-model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getModelInfo());
  } catch (error) {
    console.error("Model info error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
