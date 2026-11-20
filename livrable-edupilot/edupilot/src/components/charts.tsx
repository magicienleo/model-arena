"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const axisStyle = { fill: "#7c8aa5", fontSize: 11 };
const tooltipStyle = {
  background: "white",
  border: "1px solid #dbe4f0",
  borderRadius: 12,
  boxShadow: "0 12px 32px -16px rgba(16,33,68,.45)",
  fontSize: 12,
};

export function AttendanceChart({ data }: { data: Array<{ label: string; reel: number; attendu: number; prevu: number | null }> }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="#e8edf6" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, "dataMax + 20"]} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 700, marginBottom: 4 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Area type="monotone" name="Couverts réels" dataKey="reel" stroke="#2563eb" strokeWidth={2.5} fill="url(#gradReel)" dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" name="Prévus (effectif)" dataKey="attendu" stroke="#a5b4cb" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({ data }: { data: Array<{ label: string; prevu: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 6" stroke="#e8edf6" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5fb" }} />
        <Bar name="Couverts prévus" dataKey="prevu" fill="#2563eb" radius={[7, 7, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WasteChart({ data }: { data: Array<{ label: string; percent: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id="gradWaste" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="#e8edf6" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} %`, "Pertes"]} />
        <ReferenceLine y={12} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Seuil 12 %", fill: "#dc2626", fontSize: 10, position: "insideTopRight" }} />
        <Area type="monotone" dataKey="percent" name="Pertes" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradWaste)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BudgetChart({ data }: { data: Array<{ month: string; consomme: number; prevu: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={3}>
        <CartesianGrid strokeDasharray="3 6" stroke="#e8edf6" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Math.round(Number(v)).toLocaleString("fr-FR")} €`, ""]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="consomme" name="Consommé" fill="#1b397c" radius={[6, 6, 0, 0]} />
        <Bar dataKey="prevu" name="Prévu" fill="#b8cfee" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
