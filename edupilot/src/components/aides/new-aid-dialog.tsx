"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { createAidAction, type ActionResult } from "@/actions/aides";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const schema = z.object({
  familyId: z.string(),
  applicantName: z.string().min(2, "Nom requis").max(120),
  quotientFamilial: z.coerce.number().int().min(0).max(10000),
  amountAsked: z.coerce.number().min(1).max(5000),
  reason: z.string().min(2).max(240),
});
type Values = z.infer<typeof schema>;

export function NewAidDialog({ families }: { families: Array<{ id: string; label: string; quotientFamilial: number }> }) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState<ActionResult | null>(null);
  const [pending, startTransition] = React.useTransition();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { familyId: "", applicantName: "", quotientFamilial: 500, amountAsked: 150, reason: "Frais de cantine" },
  });

  const onSubmit = handleSubmit((values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([key, val]) => fd.set(key, String(val ?? "")));
    startTransition(async () => {
      const result = await createAidAction(fd);
      setMessage(result);
      if (result.ok) { setOpen(false); setMessage(null); }
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" /> Nouvelle demande</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déposer une demande d&apos;aide</DialogTitle>
          <DialogDescription>La demande sera enregistrée en attente de scoring IA, puis validée par un agent.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Famille (facultatif)">
            <Select {...register("familyId")} onChange={(e) => {
              const family = families.find((f) => f.id === e.target.value);
              setValue("familyId", e.target.value);
              if (family) {
                setValue("applicantName", family.label);
                setValue("quotientFamilial", family.quotientFamilial);
              }
            }}>
              <option value="">— Saisie manuelle —</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.label} · QF {f.quotientFamilial}</option>)}
            </Select>
          </Field>
          <Field label="Nom du demandeur" error={errors.applicantName?.message}>
            <Input placeholder="EXEMPLE Marie" {...register("applicantName")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quotient familial" error={errors.quotientFamilial?.message}>
              <Input type="number" min={0} {...register("quotientFamilial")} />
            </Field>
            <Field label="Montant demandé (€)" error={errors.amountAsked?.message}>
              <Input type="number" min={0} step="1" {...register("amountAsked")} />
            </Field>
          </div>
          <Field label="Motif" error={errors.reason?.message}>
            <Textarea {...register("reason")} />
          </Field>
          {message && !message.ok && <p className="text-sm font-semibold text-red-600">{message.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}Enregistrer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
