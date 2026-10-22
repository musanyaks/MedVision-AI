"use client";

import { CheckCircle2, AlertTriangle, ScanEye, Thermometer } from "lucide-react";
import { Card } from "./Card";

export interface DiagnosisResultData {
  label: string;
  probability: number;
  confidence: number;
  classes: string[];
  heatmapBase64?: string | null;
  recordId?: number;
}

interface DiagnosisResultProps {
  result: DiagnosisResultData;
}

export function DiagnosisResult({ result }: DiagnosisResultProps) {
  const isPneumonia = result.label === "PNEUMONIA";
  const confidencePct = (result.confidence * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <Card className={`border-l-4 ${isPneumonia ? "border-l-rose-500" : "border-l-emerald-500"}`}>
        <div className="flex items-start gap-4">
          <div
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${
              isPneumonia ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {isPneumonia ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Prediction: {result.label}
            </h3>
            <p className="text-slate-600">
              Confidence: <span className="font-semibold">{confidencePct}%</span>
            </p>
            <p className="text-sm text-slate-500">
              Raw pneumonia probability: {(result.probability * 100).toFixed(2)}%
            </p>
            {result.recordId && (
              <p className="mt-2 text-xs text-slate-400">
                Record ID: {result.recordId}
              </p>
            )}
          </div>
        </div>
      </Card>

      {result.heatmapBase64 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <ScanEye size={18} className="text-indigo-600" />
            <h4 className="font-semibold text-slate-900">Explainable AI (Occlusion Sensitivity)</h4>
          </div>
          <img
            src={`data:image/png;base64,${result.heatmapBase64}`}
            alt="Occlusion sensitivity explanation"
            className="w-full rounded-lg border border-slate-200"
          />
          <p className="mt-3 text-sm text-slate-600">
            The heatmap highlights the regions of the X-ray that most influenced the
            model&apos;s decision. Red areas indicate higher occlusion sensitivity,
            i.e. regions where masking changed the prediction most.
          </p>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Thermometer size={18} className="text-rose-600" />
          <h4 className="font-semibold text-slate-900">Clinical interpretation</h4>
        </div>
        <p className="text-sm text-slate-600">
          {isPneumonia
            ? "The model detected patterns consistent with pneumonia. This is an automated screening result and should be reviewed by a qualified radiologist or physician before any clinical decision."
            : "The model did not detect strong pneumonia-related patterns. Continue standard clinical evaluation and correlate with symptoms and laboratory findings."}
        </p>
      </Card>
    </div>
  );
}
