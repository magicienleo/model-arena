"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { createShiftAction } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { todayISO } from "@/lib/utils";

const schema = z.object({
  staffId: z.string().min(1), schoolId: z.string().min(1), date: z.string().min(1),
  startHour: z.string().min(4), endHour: z.string().min(4), expectedCovers: z.coerce.number().min(0),
});
type Values = z.infer<typeof schema>;

export function ShiftDialog({ staff, schools }: {
  staff: Array<{ id: string; label: string }>; schools: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const router = useRouter();
  const { register, handleSubmit } = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { staffId: staff[0]?.id ?? "", schoolId: schools[0]?.id ?? "", date: todayISO(), startHour: "08:30", endHour: "14:30", expectedCovers: 60 },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Ajouter un poste</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Planifier un poste</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit((values) => {
          const fd = new FormData();
          Object.entries(values).forEach(([k, v]) => fd.set(k, String(v)));
          startTransition(async () => {
            const result = await createShiftAction(fd);
            setMessage(result.message);
            if (result.ok) { setOpen(false); router.refresh(); }
          });
        })}>
          <Field label="Agent"><Select {...register("staffId")}>{staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          <Field label="Établissement"><Select {...register("schoolId")}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date"><Input type="date" {...register("date")} /></Field>
            <Field label="Début"><Input type="time" {...register("startHour")} /></Field>
            <Field label="Fin"><Input type="time" {...register("endHour")} /></Field>
          </div>
          <Field label="Couverts attendus (issus de la prévision IA)"><Input type="number" min={0} {...register("expectedCovers")} /></Field>
          {message && <p className="text-xs text-red-600">{message}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}Enregistrer</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
