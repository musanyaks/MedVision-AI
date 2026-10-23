"use client";

import { useState, useCallback } from "react";
import { Upload, Loader2, Stethoscope } from "lucide-react";
import type { DiagnosisResultData } from "./DiagnosisResult";
import { compressImage } from "@/lib/compressImage";

interface DiagnoseFormProps {
  onResult: (result: DiagnosisResultData) => void;
  onLoading: (loading: boolean) => void;
}

export function DiagnoseForm({ onResult, onLoading }: DiagnoseFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback((selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      alert("Please upload a valid image file (JPEG/PNG).");
      return;
    }
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files?.[0] ?? null);
    },
    [handleFile]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    onLoading(true);

    try {
      // Shrink the image first so the upload stays under Vercel's 4.5 MB limit
      const compressed = await compressImage(file);

      const form = new FormData();
      form.append("file", compressed);
      if (patientName) form.append("patientName", patientName);
      if (patientId) form.append("patientId", patientId);
      if (notes) form.append("notes", notes);

      const res = await fetch("/api/diagnose", { method: "POST", body: form });
      const text = await res.text();

      let data: unknown = null;
      try {
        data = JSON.parse(text);
      } catch {
        // Non-JSON reply (e.g. a platform error page)
      }

      if (!res.ok) {
        const apiError =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : null;
        throw new Error(apiError || `Request failed (${res.status}): ${text.slice(0, 200)}`);
      }

      if (!data) throw new Error("Server returned an invalid response");
      onResult(data as DiagnosisResultData);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
      onLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragOver
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 bg-slate-50 hover:border-indigo-400"
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="mx-auto max-h-64 rounded-lg object-contain shadow"
          />
        ) : (
          <div className="space-y-2">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-indigo-600">
              <Upload size={24} />
            </div>
            <p className="font-medium text-slate-700">
              Drop a chest X-ray here or click to browse
            </p>
            <p className="text-sm text-slate-500">JPG / PNG up to 10 MB</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Patient name
          </label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="e.g. John Doe"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Patient ID
          </label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="e.g. P-12345"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Clinical notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Optional symptoms or history..."
        />
      </div>

      <button
        type="submit"
        disabled={!file || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Analyzing X-ray...
          </>
        ) : (
          <>
            <Stethoscope size={18} />
            Run AI Diagnosis
          </>
        )}
      </button>
    </form>
  );
}