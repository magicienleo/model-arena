"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Checkbox from "@radix-ui/react-checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { createHaccpCheckAction } from "@/actions/haccp";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { todayISO } from "@/lib/utils";

const schema = z.object({
  schoolId: z.string().min(1),
  date: z.string().min(1),
  checkType: z.enum(["RECEPTION", "STOCKAGE", "CUISSE", "NETTOYAGE"]),
  temperature: z.coerce.number().min(-30).max(200),
  productLabel: z.string().optional(),
  dlc: z.string().optional(),
  note: z.string().optional(),
  conform: z.boolean(),
});
type Values = z.infer<typeof schema>;

const TYPES: Array<[string, string]> = [
  ["RECEPTION", "Réception des denrées"], ["STOCKAGE", "Stockage / DLC"],
  ["CUISSE", "Cuisson"], ["NETTOYAGE", "Nettoyage / désinfection"],
];

export function CheckForm({ schools }: { schools: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { schoolId: schools[0]?.id ?? "", date: todayISO(), checkType: "RECEPTION", temperature: 4, productLabel: "", dlc: "", note: "", conform: true },
  });
  const conform = watch("conform");

  const onSubmit = handleSubmit((values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([key, value]) => fd.set(key, String(value ?? "")));
    const fileInput = document.getElementById("haccp-photo") as HTMLInputElement | null;
    if (fileInput?.files?.[0]) fd.set("photo", fileInput.files[0]);
    startTransition(async () => {
      const result = await createHaccpCheckAction(fd);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) { router.refresh(); if (fileInput) fileInput.value = ""; }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Établissement" error={errors.schoolId?.message}>
          <Select {...register("schoolId")}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Date">
          <Input type="date" {...register("date")} />
        </Field>
        <Field label="Type de contrôle">
          <Select {...register("checkType")}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </Field>
        <Field label="Température (°C)" error={errors.temperature?.message}>
          <Input type="number" step="0.1" {...register("temperature")} />
        </Field>
        <Field label="Produit / lot">
          <Input placeholder="Ex. Poulet local — lot A12" {...register("productLabel")} />
        </Field>
        <Field label="DLC (date limite)">
          <Input type="date" {...register("dlc")} />
        </Field>
      </div>
      <Field label="Observation">
        <Textarea placeholder="Constat, action corrective éventuelle…" {...register("note")} />
      </Field>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3">
          <Checkbox.Root
            checked={conform}
            onCheckedChange={(v) => setValue("conform", v === true)}
            className="grid size-5 place-items-center rounded-md border border-navy-300 bg-white data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          >
            <Checkbox.Indicator>{conform && <Check className="size-3.5 text-white" />}</Checkbox.Indicator>
          </Checkbox.Root>
          <span className="text-sm font-semibold">Contrôle conforme</span>
          <span className="ml-auto text-[11px] text-muted-foreground">Décochez pour créer une alerte</span>
        </label>
        <Field label="Photo (facultatif) — stockée localement">
          <Input id="haccp-photo" type="file" accept="image/*" className="h-auto py-2" />
        </Field>
      </div>
      {message && <p className={`text-sm font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Enregistrer le contrôle</Button>
    </form>
  );
}
