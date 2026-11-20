"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { validateAidAction, type ActionResult } from "@/actions/aides";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { AiNotice } from "@/components/ui/misc";

const schema = z.object({
  finalAmount: z.coerce.number().min(0).max(5000),
  reason: z.string().min(3, "Motif obligatoire").max(500),
});
type Values = z.infer<typeof schema>;

export function AidValidationForm({ aidId, suggestedAmount }: { aidId: string; suggestedAmount: number }) {
  const router = useRouter();
  const [decision, setDecision] = React.useState<"APPROVED" | "REJECT">("APPROVED");
  const [message, setMessage] = React.useState<ActionResult | null>(null);
  const [pending, startTransition] = React.useTransition();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { finalAmount: suggestedAmount, reason: "Dossier vérifié : pièces conformes et situation confirmée." },
  });
  const amount = Number(watch("finalAmount"));
  const delta = Number.isFinite(amount) ? amount - suggestedAmount : 0;

  const submit = (values: Values, choice: "APPROVED" | "REJECT") => {
    setDecision(choice);
    setMessage(null);
    const fd = new FormData();
    fd.set("aidId", aidId);
    fd.set("finalAmount", String(values.finalAmount));
    fd.set("reason", values.reason);
    fd.set("decision", choice);
    startTransition(async () => {
      const result = await validateAidAction({ ok: false, message: "" }, fd);
      setMessage(result);
      if (result.ok) router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit((v) => submit(v, decision))} className="space-y-4">
      <AiNotice>Le score IA est indicatif. Le montant final et le motif relèvent de votre responsabilité.</AiNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Montant accordé (€)" error={errors.finalAmount?.message}>
          <Input type="number" min={0} step="1" className="h-12 text-lg font-bold" {...register("finalAmount")} />
        </Field>
        <div className="flex flex-col justify-center rounded-xl border border-dashed border-navy-200 bg-navy-50/60 p-3">
          <span className="text-xs font-semibold text-navy-800">Écart avec la suggestion IA</span>
          <span className={`text-xl font-black ${delta === 0 ? "text-navy-600" : delta > 0 ? "text-emerald-600" : "text-red-600"}`}>{delta > 0 ? "+" : ""}{delta} €</span>
        </div>
      </div>
      <Field label="Motif de la décision (obligatoire)" error={errors.reason?.message}>
        <Textarea {...register("reason")} />
      </Field>
      {message && <p className={`rounded-xl border px-3 py-2 text-sm font-semibold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.message}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" className="flex-1" disabled={pending} onClick={() => setDecision("APPROVED")}>
          {pending && decision === "APPROVED" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accorder l&apos;aide
        </Button>
        <Button type="submit" variant="outline" size="lg" disabled={pending} onClick={() => setDecision("REJECT")}>
          {pending && decision === "REJECT" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Refuser
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5 text-emerald-600" /> Décision horodatée avec la suggestion IA d&apos;origine.</p>
    </form>
  );
}
