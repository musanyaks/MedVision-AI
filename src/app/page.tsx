"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { DiagnoseForm } from "@/components/DiagnoseForm";
import { DiagnosisResult, type DiagnosisResultData } from "@/components/DiagnosisResult";
import { Card } from "@/components/Card";

export default function HomePage() {
  const [result, setResult] = useState<DiagnosisResultData | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Automated Chest X-Ray Diagnosis
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
            Deep-learning pipeline for pneumonia detection, powered by an ONNX
            ResNet18 classifier and occlusion-sensitivity explainability.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Upload Chest X-Ray
            </h2>
            <DiagnoseForm onResult={setResult} onLoading={setLoading} />
          </Card>

          <div>
            {loading && (
              <Card className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <p className="font-medium text-slate-700">
                  Running neural network inference...
                </p>
                <p className="text-sm text-slate-500">
                  Preprocessing &rarr; ResNet18 feature extraction &rarr; classification
                  &rarr; occlusion sensitivity explanation
                </p>
              </Card>
            )}

            {!loading && result && (
              <DiagnosisResult result={result as Parameters<typeof DiagnosisResult>[0]["result"]} />
            )}

            {!loading && !result && (
              <Card className="flex h-full flex-col items-center justify-center py-16 text-center text-slate-500">
                <p className="font-medium">Upload an X-ray image to begin</p>
                <p className="mt-1 text-sm">The AI result will appear here.</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
