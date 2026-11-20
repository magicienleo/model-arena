"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, ArrowRight, Building2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEMO = [
  { label: "Directrice · Fort-de-France", email: "directeur@fdf.edupilot.local", role: "Tous les accès" },
  { label: "Responsable restauration", email: "restauration@fdf.edupilot.local", role: "Prévisions & HACCP" },
  { label: "Agent aides sociales", email: "aides@fdf.edupilot.local", role: "Aides & contrôle" },
  { label: "Directeur · Le Lamentin", email: "directeur@lamentin.edupilot.local", role: "Autre caisse" },
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [email, setEmail] = React.useState("directeur@fdf.edupilot.local");
  const [password, setPassword] = React.useState("edupilot");

  return (
    <div className="flex min-h-screen bg-white">
      {/* Panneau institutionnel */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-950 via-navy-800 to-[#1749a0] px-12 py-12 text-white lg:flex">
        <div className="grid-pattern absolute inset-0 opacity-50" />
        <div className="absolute -right-24 top-24 size-[420px] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-[460px] rounded-full bg-sky-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white text-xl font-black text-navy-800">É</div>
          <div>
            <p className="text-xl font-black leading-tight">ÉduPilot</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy-200">Caisse des Écoles · Martinique</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-amber-300" /> Pilotage intelligent & IA supervisée
          </div>
          <h1 className="text-[42px] font-black leading-[1.08] tracking-tight">
            Mieux nourrir<br />les enfants,<br /><span className="text-amber-300">mieux piloter</span> la caisse.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-navy-100">
            Prévisions de fréquentation, lutte contre le gaspillage, aides sociales et conformité HACCP —
            dans un seul outil souverain, hébergé sur votre serveur.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3 border-t border-white/15 pt-6">
            {[["288", "enfants suivis"], ["2", "caisses pilotes"], ["100 %", "données locales"]].map(([value, label]) => (
              <div key={label}>
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-[11px] text-navy-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-navy-300">© {new Date().getFullYear()} ÉduPilot · Démonstration — données fictives</p>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-navy-900 text-lg font-black text-white">É</div>
            <span className="text-lg font-black text-navy-900">ÉduPilot</span>
          </div>
          <p className="label-caps mb-2">Espace agents — back-office</p>
          <h2 className="text-3xl font-black tracking-tight text-navy-950">Connexion sécurisée</h2>
          <p className="mt-2 text-sm text-muted-foreground">Accédez au pilotage de votre Caisse des Écoles.</p>

          <form action={formAction} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">Adresse e-mail professionnelle</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input id="email" name="email" type="email" autoComplete="username" className="pl-10" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@caisse.fr" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold">Mot de passe</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input id="password" name="password" type="password" autoComplete="current-password" className="pl-10"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            {state.error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Connexion en cours…" : "Se connecter"} {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-border bg-navy-50/60 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold text-navy-800">
              <Building2 className="size-4" /> Comptes de démonstration
            </p>
            <div className="grid gap-1.5">
              {DEMO.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => { setEmail(account.email); setPassword("edupilot"); }}
                  className="focus-ring flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-white hover:shadow-sm"
                >
                  <span className="font-semibold text-navy-900">{account.label}</span>
                  <span className="text-muted-foreground">{account.role}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 border-t border-navy-100 pt-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600" /> Mot de passe commun : <strong>edupilot</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
