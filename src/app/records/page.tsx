"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/Card";

interface Record {
  id: number;
  patientId: string | null;
  patientName: string | null;
  label: string;
  probability: number;
  confidence: number;
  createdAt: string;
  notes: string | null;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((data) => {
        setRecords(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Patient Records</h1>
          <p className="text-slate-600">
            Stored AI diagnoses with probabilities and timestamps.
          </p>
        </div>

        <Card>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Prediction</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                    <th className="px-4 py-3 font-medium">Probability</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No records yet. Run a diagnosis to populate this table.
                      </td>
                    </tr>
                  )}
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">#{r.id}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.patientName || "—"}
                        {r.patientId && (
                          <span className="block text-xs text-slate-400">{r.patientId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            r.label === "PNEUMONIA"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {r.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {(r.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {(r.probability * 100).toFixed(2)}%
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">
                        {r.notes || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {r.createdAt ? format(new Date(r.createdAt), "MMM d, yyyy HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
