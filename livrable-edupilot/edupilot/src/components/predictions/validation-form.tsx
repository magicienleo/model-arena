"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { validatePredictionAction, type ActionResult } from "@/actions/predictions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { AiNotice } from "@/components/ui/misc";

const schema = z.object({
  humanCovers: z.coerce.number().int().min(0, "Nombre invalide").max(2000),
  humanMeals: z.coerce.number().int().min(0, "Nombre invalide").max(3000),
  reason: z.string().max(500, "500 caractères maximum"),
});
type FormValues = z.infer<typeof schema>;

export function ValidationForm({ predictionId, aiCovers, aiMeals }: {
  predictionId: string; aiCovers: number; aiMeals: number;
}) {
  const router = useRouter();
  const [decision, setDecision] = React.useState<"VALIDATE" | "REJECT">("VALIDATE");
  const [message, setMessage] = React.useState<ActionResult | null>(null);
  const [pending, startTransition] = React.useTransition();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { humanCovers: aiCovers, humanMeals: aiMeals, reason: "" },
  });
  const covers = Number(watch("humanCovers"));
  const delta = Number.isFinite(covers) ? covers - aiCovers : 0;

  const submit = (values: FormValues, choice: "VALIDATE" | "REJECT") => {
    setDecision(choice);
    setMessage(null);
    const fd = new FormData();
    fd.set("predictionId", predictionId);
    fd.set("humanCovers", String(values.humanCovers));
    fd.set("humanMeals", String(values.humanMeals));
    fd.set("reason", values.reason);
    fd.set("decision", choice);
    startTransition(async () => {
      const result = await validatePredictionAction({ ok: false, message: "" }, fd);
      setMessage(result);
      if (result.ok) router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit((values) => submit(values, decision))} className="space-y-5">
      <AiNotice>
        Vous êtes responsable de la décision finale. Votre saisie et l&apos;écart avec la suggestion IA sont conservés dans le journal d&apos;audit.
      </AiNotice>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Couverts retenus (humain)" error={errors.humanCovers?.message} hint={`Suggestion IA : ${aiCovers} couverts`}>
          <Input type="number" min={0} max={2000} className="h-12 text-lg font-bold tabular-nums" {...register("humanCovers")} />
        </Field>
        <Field label="Repas à commander" error={errors.humanMeals?.message} hint={`Suggestion IA : ${aiMeals} repas`}>
          <Input type="number" min={0} max={3000} className="h-12 text-lg font-bold tabular-nums" {...register("humanMeals")} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-dashed border-navy-200 bg-navy-50/60 px-4 py-3">
        <span className="text-sm font-semibold text-navy-800">Écart avec la proposition IA</span>
        <span className={`text-xl font-black tabular-nums ${delta === 0 ? "text-navy-600" : delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
          {delta > 0 ? "+" : ""}{delta} couverts
        </span>
      </div>

      <Field label="Motif de l'ajustement (obligatoire en cas d'écart)" error={errors.reason?.message}>
        <Textarea placeholder="Ex. Groupe de 12 élèves confirmé par la directrice d'école" {...register("reason")} />
      </Field>

      {message && (
        <p className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`} role="status">
          {message.message}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" className="flex-1" disabled={pending} onClick={() => setDecision("VALIDATE")}>
          {pending && decision === "VALIDATE" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Valider la décision
        </Button>
        <Button type="submit" variant="outline" size="lg" disabled={pending} onClick={() => setDecision("REJECT")}>
          {pending && decision === "REJECT" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
          Rejeter la suggestion
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-600" /> Aucune commande n&apos;est passée automatiquement : la validation reste humaine.
      </p>
    </form>
  );
}
