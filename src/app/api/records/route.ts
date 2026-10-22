import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagnoses } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.query.diagnoses.findMany({
      orderBy: [desc(diagnoses.createdAt)],
      limit: 200,
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Records fetch error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
