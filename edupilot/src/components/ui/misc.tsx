import * as React from "react";
import { AlertTriangle, Bot, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string; title: string; description?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        {eyebrow && <p className="label-caps mb-2 text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AiNotice({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ai-banner", className)} role="note">
      <Bot className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">
        <strong>Suggestion IA — validation humaine obligatoire.</strong>{" "}
        {children ?? "Aucune décision n'est appliquée automatiquement : vérifiez et validez chaque proposition."}
      </p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, description, action }: {
  icon?: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-navy-50 text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AlertStrip({ variant = "warning", title, children }: {
  variant?: "warning" | "danger" | "info" | "success"; title: string; children: React.ReactNode;
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[variant];
  const Icon = variant === "danger" ? AlertTriangle : variant === "success" ? ShieldCheck : Info;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", styles)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div><strong className="font-bold">{title}</strong><span className="ml-1 opacity-90">{children}</span></div>
    </div>
  );
}

export function StatDelta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold", positive ? "text-emerald-600" : "text-red-600")}>
      {value > 0 ? "↗" : value < 0 ? "↘" : "→"} {Math.abs(value).toFixed(1).replace(".", ",")} %
    </span>
  );
}

export function ProgressBar({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "accent" | "danger" }) {
  const color = tone === "danger" ? "bg-red-500" : tone === "accent" ? "bg-amber-400" : "bg-primary";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
