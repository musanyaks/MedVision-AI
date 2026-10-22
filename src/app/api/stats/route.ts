import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagnoses, datasetStats, modelMetrics } from "@/db/schema";
import { sql, count, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const total = await db.select({ value: count() }).from(diagnoses);
    const byLabel = await db
      .select({
        label: diagnoses.label,
        count: count(),
      })
      .from(diagnoses)
      .groupBy(diagnoses.label);

    const avgConfidence = await db
      .select({
        label: diagnoses.label,
        avgConfidence: sql<number>`avg(${diagnoses.confidence})`,
      })
      .from(diagnoses)
      .groupBy(diagnoses.label);

    const recent = await db
      .select({
        label: diagnoses.label,
        probability: diagnoses.probability,
        confidence: diagnoses.confidence,
        createdAt: diagnoses.createdAt,
      })
      .from(diagnoses)
      .orderBy(sql`${diagnoses.createdAt} desc`)
      .limit(50);

    const dataset = await db.select().from(datasetStats);
    const metrics = await db.select().from(modelMetrics);

    return NextResponse.json({
      total: total[0]?.value ?? 0,
      byLabel,
      avgConfidence,
      recent,
      dataset,
      metrics,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
