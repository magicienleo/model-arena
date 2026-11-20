"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, UserPlus } from "lucide-react";
import { createUserAction, type ActionResult } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";

const schema = z.object({
  name: z.string().min(2), email: z.email(), role: z.string(), password: z.string().min(8),
});
type Values = z.infer<typeof schema>;

export function UserDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<ActionResult | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", role: "STAFF", password: "edupilot2026" },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="size-4" /> Ajouter un agent</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer un compte agent</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((values) => {
          const fd = new FormData();
          Object.entries(values).forEach(([key, value]) => fd.set(key, String(value)));
          startTransition(async () => {
            const result = await createUserAction({ ok: false, message: "" }, fd);
            setMessage(result);
            if (result.ok) { setOpen(false); setMessage(null); router.refresh(); }
          });
        })} className="space-y-4">
          <Field label="Nom complet" error={errors.name?.message}><Input {...register("name")} /></Field>
          <Field label="E-mail professionnel" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
          <Field label="Rôle">
            <Select {...register("role")}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</Select>
          </Field>
          <Field label="Mot de passe initial" hint="8 caractères minimum"><Input type="text" {...register("password")} /></Field>
          {message && <p className={`text-xs font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.message}</p>}
          <div className="flex justify-end gap-2"><Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}Créer</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
