"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

interface Stats {
  total: number;
  byLabel: { label: string; count: number }[];
  avgConfidence: { label: string; avgConfidence: number }[];
  recent: {
    label: string;
    probability: number;
    confidence: number;
    createdAt: string;
  }[];
  dataset: { split: string; classLabel: string; count: number }[];
  metrics: { metricName: string; metricValue: number; split: string }[];
}

const COLORS = ["#10b981", "#f43f5e", "#6366f1", "#f59e0b"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="grid min-h-[60vh] place-items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </main>
      </>
    );
  }

  const datasetChart = stats?.dataset ?? [];
  const metricRows = stats?.metrics ?? [];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Data Science Dashboard</h1>
          <p className="text-slate-600">
            Real-time analytics from stored diagnoses and the underlying model evaluation.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm font-medium text-slate-500">Total diagnoses</p>
            <p className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Pneumonia cases</p>
            <p className="text-3xl font-bold text-rose-600">
              {stats?.byLabel.find((b) => b.label === "PNEUMONIA")?.count ?? 0}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Normal cases</p>
            <p className="text-3xl font-bold text-emerald-600">
              {stats?.byLabel.find((b) => b.label === "NORMAL")?.count ?? 0}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Avg confidence</p>
            <p className="text-3xl font-bold text-indigo-600">
              {stats?.recent.length
                ? (
                    stats.recent.reduce((a, b) => a + b.confidence, 0) /
                    stats.recent.length
                  ).toFixed(2)
                : "0.00"}
            </p>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Diagnosis distribution
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.byLabel ?? []}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {(stats?.byLabel ?? []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Average confidence by label
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.avgConfidence ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(3) : v)} />
                  <Bar dataKey="avgConfidence" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Training dataset class distribution
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datasetChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="classLabel" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Recent inference probabilities
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[...(stats?.recent ?? [])].reverse().map((r, i) => ({
                    ...r,
                    idx: i + 1,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(3) : v)} />
                  <Line
                    type="monotone"
                    dataKey="probability"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Model evaluation metrics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Metric</th>
                    <th className="px-4 py-3 font-medium">Split</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metricRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-slate-500">
                        No metrics seeded yet. Run the training pipeline to populate.
                      </td>
                    </tr>
                  )}
                  {metricRows.map((m) => (
                    <tr key={`${m.metricName}-${m.split}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {m.metricName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.split}</td>
                      <td className="px-4 py-3 text-slate-900">
                        {m.metricValue.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
