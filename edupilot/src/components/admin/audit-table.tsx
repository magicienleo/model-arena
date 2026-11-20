"use client";

import * as React from "react";
import { Bot, Search, UserRound } from "lucide-react";
import type { AuditLog } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

export function AuditTable({ logs }: { logs: AuditLog[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("ALL");
  const actions = Array.from(new Set(logs.map((l) => l.action))).sort();
  const filtered = logs.filter((log) => {
    const matchesQuery = `${log.action} ${log.actorName} ${log.detail} ${log.entityId}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "ALL" || log.action === filter);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher dans le journal…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-white px-3 text-sm">
          <option value="ALL">Toutes les actions</option>
          {actions.map((action) => <option key={action} value={action}>{action}</option>)}
        </select>
      </div>
      <div className="max-h-[620px] overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/95 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
            <tr>{["Date", "Action", "Acteur", "Suggestion IA", "Décision humaine", "Détail"].map((h) => <th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border/70 bg-white">
            {filtered.map((log) => (
              <tr key={log.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
                <td className="px-3 py-3"><Badge variant={log.aiSuggestion ? "ai" : "default"}>{log.action}</Badge></td>
                <td className="whitespace-nowrap px-3 py-3 text-xs"><span className="inline-flex items-center gap-1"><UserRound className="size-3" />{log.actorName}</span></td>
                <td className="max-w-[240px] px-3 py-3 text-xs text-muted-foreground">
                  {log.aiSuggestion ? <span className="inline-flex items-start gap-1"><Bot className="mt-0.5 size-3 shrink-0 text-violet-500" /><code className="break-all">{JSON.stringify(log.aiSuggestion)}</code></span> : "—"}
                </td>
                <td className="max-w-[240px] px-3 py-3 text-xs"><code className="break-all">{log.humanDecision ? JSON.stringify(log.humanDecision) : "—"}</code></td>
                <td className="max-w-[220px] px-3 py-3 text-xs text-muted-foreground">{log.detail}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune entrée ne correspond à ce filtre.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">{filtered.length} entrée(s) affichée(s) sur {logs.length} · journal conservé localement</p>
    </div>
  );
}
