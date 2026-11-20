"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { updateOrgSettingsAction, type ActionResult } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

export function SettingsForm({ org }: {
  org: { name: string; budget: number; alertThresholdWaste: number; alertThresholdOccupancy: number; aidBareme: Record<string, number>; calendar: string[] };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateOrgSettingsAction, { ok: false, message: "" });
  const bareme = org.aidBareme ?? {};
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la caisse">
          <Input name="name" defaultValue={org.name} />
        </Field>
        <Field label="Budget annuel (€)">
          <Input name="budget" type="number" min={0} step="1000" defaultValue={org.budget} />
        </Field>
        <Field label="Seuil d'alerte pertes (%)" hint="Au-delà, une alerte est créée automatiquement">
          <Input name="thresholdWaste" type="number" min={0} max={1} step="0.01" defaultValue={org.alertThresholdWaste} />
        </Field>
        <Field label="Seuil d'occupation (%)">
          <Input name="thresholdOccupancy" type="number" min={0} max={1} step="0.01" defaultValue={org.alertThresholdOccupancy} />
        </Field>
      </div>
      <div>
        <p className="label-caps mb-3">Barème des aides (€)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["base", "Base"], ["partQ1", "Part Q1"], ["partQ2", "Part Q2"], ["partQ3", "Part Q3"], ["max", "Plafond"]].map(([key, label]) => (
            <Field key={key} label={label}>
              <Input name={key} type="number" min={0} defaultValue={bareme[key] ?? 0} />
            </Field>
          ))}
        </div>
      </div>
      <Field label="Jours fériés complémentaires (AAAA-MM-JJ, séparés par des virgules)">
        <Textarea name="calendar" defaultValue={(org.calendar ?? []).join(", ")} />
      </Field>
      {state.message && <p className={`text-sm font-semibold ${state.ok ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Enregistrer les paramètres</Button>
    </form>
  );
}
