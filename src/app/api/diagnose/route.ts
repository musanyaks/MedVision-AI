import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { diagnoses } from "@/db/schema";
import { predict, generateOcclusionHeatmap } from "@/lib/onnx-model";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const patientId = (form.get("patientId") as string) || null;
    const patientName = (form.get("patientName") as string) || null;
    const notes = (form.get("notes") as string) || null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file must be an image" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Run ONNX inference in-process
    const prediction = await predict(buffer);

    // Generate occlusion-sensitivity explanation
    const heatmapBase64 = await generateOcclusionHeatmap(buffer);

    // Persist diagnosis
    const [record] = await db
      .insert(diagnoses)
      .values({
        patientId,
        patientName,
        label: prediction.label,
        probability: prediction.probability,
        confidence: prediction.confidence,
        heatmapBase64,
        imageMimeType: file.type,
        notes,
      })
      .returning();

    return NextResponse.json({
      ...prediction,
      heatmapBase64,
      recordId: record.id,
    });
  } catch (error) {
    console.error("Diagnose error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
