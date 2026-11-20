"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Accuracy } from "@/lib/ml/predict";

export function AccuracyChart({ accuracy }: { accuracy: Accuracy }) {
  const data = accuracy.series.slice(-21).map((s) => ({
    date: s.date.slice(8),
    Prévu: s.predicted,
    Réel: s.actual,
  }));
  if (data.length < 2) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Pas encore assez d&apos;historique pour tracer la courbe d&apos;exactitude.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke="#e8edf6" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#7c8aa5", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#7c8aa5", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "white", border: "1px solid #dbe4f0", borderRadius: 12, fontSize: 12 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="Prévu" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="Réel" stroke="#2563eb" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
