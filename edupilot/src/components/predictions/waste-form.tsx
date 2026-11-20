"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Loader2, Scale } from "lucide-react";
import { logWasteAction } from "@/actions/predictions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { todayISO } from "@/lib/utils";

const schema = z.object({
  schoolId: z.string().min(1, "Sélectionnez un établissement"),
  date: z.string().min(1),
  covers: z.coerce.number().min(0).max(3000),
  preparedMeals: z.coerce.number().min(1, "Indiquez le nombre de repas préparés").max(3000),
  wasteKg: z.coerce.number().min(0, "Poids positif").max(500),
  menuLabel: z.string().optional(),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function WasteForm({ schools, defaultSchoolId }: { schools: Array<{ id: string; name: string }>; defaultSchoolId?: string }) {
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { schoolId: defaultSchoolId ?? schools[0]?.id ?? "", date: todayISO(), covers: 0, preparedMeals: 120, wasteKg: 0, menuLabel: "", note: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    const fd = new FormData();
    Object.entries(values).forEach(([key, value]) => fd.set(key, String(value ?? "")));
    startTransition(async () => {
      const result = await logWasteAction({ ok: false, message: "" }, fd);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) reset({ ...values, covers: 0, wasteKg: 0, note: "" });
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Établissement" error={errors.schoolId?.message}>
          <Select {...register("schoolId")}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Date du relevé" error={errors.date?.message}>
          <Input type="date" {...register("date")} />
        </Field>
        <Field label="Couverts servis" error={errors.covers?.message}>
          <Input type="number" min={0} {...register("covers")} />
        </Field>
        <Field label="Repas préparés" error={errors.preparedMeals?.message}>
          <Input type="number" min={1} {...register("preparedMeals")} />
        </Field>
        <Field label="Pertes (kg)" error={errors.wasteKg?.message}>
          <Input type="number" step="0.1" min={0} {...register("wasteKg")} />
        </Field>
        <Field label="Menu du jour">
          <Input placeholder="Ex. Colombo de cabri" {...register("menuLabel")} />
        </Field>
      </div>
      <Field label="Observation (facultatif)">
        <Textarea placeholder="Cause identifiée, action corrective…" {...register("note")} />
      </Field>
      {message && (
        <p className={`flex items-center gap-2 text-sm font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`} role="status">
          {message.ok ? <CheckCircle2 className="size-4" /> : null}{message.text}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Scale className="size-4" />}
        Enregistrer le relevé
      </Button>
    </form>
  );
}
