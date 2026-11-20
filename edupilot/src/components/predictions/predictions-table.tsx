"use client";

import * as React from "react";
import Link from "next/link";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  useReactTable, type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowDownUp, Search } from "lucide-react";
import type { Prediction } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatDay, pct } from "@/lib/utils";

type Row = { pred: Prediction; school: string };

export function PredictionsTable({ rows }: { rows: Row[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: false }]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = React.useMemo<ColumnDef<Row>[]>(() => [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => <span className="font-semibold text-navy-900">{formatDay(row.original.pred.date, { weekday: "long" })}</span>,
    },
    {
      accessorKey: "school",
      header: "Établissement",
      cell: ({ row }) => <span className="text-sm">{row.original.school}</span>,
    },
    {
      accessorKey: "covers",
      header: "Couverts IA",
      cell: ({ row }) => <span className="font-black text-navy-900 tabular-nums">{row.original.pred.predictedCovers}</span>,
      sortingFn: (a, b) => a.original.pred.predictedCovers - b.original.pred.predictedCovers,
    },
    {
      id: "interval",
      header: "Intervalle",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.original.pred.lowerBound} – {row.original.pred.upperBound}
        </span>
      ),
    },
    {
      accessorKey: "confidence",
      header: "Confiance",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${row.original.pred.confidence * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums">{pct(row.original.pred.confidence, 0)}</span>
        </div>
      ),
    },
    {
      id: "meals",
      header: "Repas conseillés",
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.pred.recommendedMeals}</span>,
    },
    {
      id: "status",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.pred.status;
        return <Badge variant={status === "VALIDATED" ? "success" : status === "REJECTED" ? "danger" : "warning"}>
          {status === "VALIDATED" ? "Validée" : status === "REJECTED" ? "Rejetée" : "À valider"}
        </Badge>;
      },
    },
    {
      id: "action",
      header: "",
      cell: ({ row }) => (
        <Link href={`/predictions/${row.original.pred.id}`} className="text-xs font-bold text-primary hover:underline">
          {row.original.pred.status === "SUGGESTED" ? "Adjust & Valider →" : "Voir la trace →"}
        </Link>
      ),
    },
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher une école…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((group) => group.headers.map((header) => (
              <th key={header.id} className="whitespace-nowrap px-3 py-3 font-bold">
                <button
                  className={cn("inline-flex items-center gap-1", header.column.getCanSort() && "hover:text-foreground")}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() && <ArrowDownUp className="size-3" />}
                </button>
              </th>
            )))}
          </thead>
          <tbody className="divide-y divide-border/70 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-navy-50/40">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-3 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune prévision ne correspond à cette recherche.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
