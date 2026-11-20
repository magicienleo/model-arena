"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { resetDataAction, rgpdDeleteFamilyAction, type ActionResult } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPanel({ families }: { families: Array<{ id: string; label: string }> }) {
  const [confirmation, setConfirmation] = React.useState("");
  const [message, setMessage] = React.useState<ActionResult | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-red-800"><ShieldAlert className="size-4" /> Réinitialiser le jeu de données</p>
        <p className="mt-1 text-xs text-red-700">Toutes les données de démonstration sont recréées from scratch. Action irréversible.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Saisissez RESET pour confirmer" className="max-w-xs bg-white" />
          <Button variant="destructive" disabled={pending || confirmation !== "RESET"} onClick={() => {
            const fd = new FormData();
            fd.set("confirm", confirmation);
            startTransition(async () => {
              const result = await resetDataAction(fd);
              setMessage(result);
              if (result.ok) { setConfirmation(""); router.refresh(); }
            });
          }}>{pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Régénérer les données</Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">RGPD — droit à l&apos;effacement</p>
        <div className="relative mb-3 max-w-sm">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher une famille…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2">
          {families.filter((f) => f.label.toLowerCase().includes(query.toLowerCase())).slice(0, 30).map((family) => (
            <div key={family.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
              <span className="truncate">{family.label}</span>
              <Button size="sm" variant="ghost" className="shrink-0 text-red-600" onClick={() => {
                const fd = new FormData();
                fd.set("familyId", family.id);
                startTransition(async () => {
                  const result = await rgpdDeleteFamilyAction(fd);
                  setMessage(result);
                  if (result.ok) router.refresh();
                });
              }}>Supprimer</Button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Export des données personnelles : disponible via le journal d&apos;audit (action RGPD_EXPORT).</p>
      </div>
      {message && <p className={`text-sm font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.message}</p>}
    </div>
  );
}
