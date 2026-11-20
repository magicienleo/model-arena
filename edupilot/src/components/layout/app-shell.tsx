"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell, CalendarDays, ChevronDown, HandHeart, LayoutDashboard, LogOut, Menu,
  PlugZap, Settings2, ShieldCheck, Sparkles, X, School2, CircleHelp,
} from "lucide-react";
import { NAV_ITEMS, ROLE_LABELS, can, type Role } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Sparkles, HandHeart, ShieldCheck, CalendarDays, PlugZap, Settings2,
};

type ShellProps = {
  user: { name: string; email: string; role: Role; orgName: string };
  alertCount: number;
  children: React.ReactNode;
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-400 via-blue-500 to-navy-800 shadow-lg shadow-navy-950/30">
        <span className="relative z-10 text-lg font-black text-white">É</span>
        <span className="grid-pattern absolute inset-0 opacity-40" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-black tracking-tight text-white">ÉduPilot</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-300">Caisse des Écoles · Martinique</div>
        </div>
      )}
    </div>
  );
}

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Navigation principale">
      {NAV_ITEMS.filter((item) => can(role, item.permission)).map((item) => {
        const Icon = icons[item.icon] ?? LayoutDashboard;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-white/15 text-white shadow-[inset_3px_0_0_0_#fbbf24]"
                : "text-navy-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active && "text-amber-300")} />
            <span className="flex-1">{item.label}</span>
            {active && <span className="size-1.5 rounded-full bg-amber-300" />}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ user, onNavigate }: Omit<ShellProps, "children" | "alertCount"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-[#101d3a]">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <div className="mx-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-navy-300">
          <School2 className="size-3.5" /> Établissement
        </div>
        <p className="mt-1 truncate text-sm font-bold text-white">{user.orgName}</p>
        <p className="text-[11px] text-navy-300">Caisse des Écoles</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="label-caps mb-3 px-3 text-navy-400">Pilotage</p>
        <NavLinks role={user.role} onNavigate={onNavigate} />
        <div className="mt-8 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-[11px] leading-relaxed text-amber-100">
          <strong className="block text-amber-200">IA supervisée</strong>
          Toute suggestion est validée par un agent avant application.
        </div>
      </div>
      <div className="border-t border-white/10 p-4">
        <Link
          href={`${pathname}?aide=1`}
          className="flex items-center gap-2 px-2 py-2 text-xs text-navy-300 transition hover:text-white"
        >
          <CircleHelp className="size-4" /> Besoin d&apos;aide ?
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="focus-ring flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-medium text-navy-200 transition hover:bg-white/10 hover:text-white"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-navy-700 text-xs font-bold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-white">{user.name}</span>
            <span className="block truncate text-[11px] text-navy-300">{ROLE_LABELS[user.role]}</span>
          </span>
          <LogOut className="size-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function AppShell({ user, alertCount, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 lg:block">
        <SidebarContent user={user} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[288px] shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white hover:bg-white/10" aria-label="Fermer">
              <X className="size-5" />
            </button>
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="focus-ring grid size-9 place-items-center rounded-lg border border-border text-navy-800 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1 lg:hidden">
            <Logo compact />
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Caisse des Écoles</span><span>/</span><span className="font-semibold text-foreground">{current?.label ?? "Pilotage"}</span>
            </div>
            <p className="truncate text-sm font-bold text-navy-900">
              {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
            </p>
          </div>
          <Badge variant="ai" className="hidden sm:inline-flex"><Sparkles className="size-3" /> IA supervisée</Badge>
          <Link
            href="/dashboard#alertes"
            className="focus-ring relative grid size-9 place-items-center rounded-lg border border-border bg-white text-navy-800 transition hover:bg-navy-50"
            aria-label={`${alertCount} alertes`}
          >
            <Bell className="size-[18px]" />
            {alertCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">{alertCount > 9 ? "9+" : alertCount}</span>}
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="grid size-9 place-items-center rounded-full bg-navy-100 text-xs font-bold text-navy-800">{initials(user.name)}</span>
            <div className="leading-tight">
              <p className="text-xs font-bold text-navy-900">{user.name.split(" ")[0]}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="border-t border-border/70 bg-white/60 px-6 py-4 text-center text-[11px] text-muted-foreground">
          ÉduPilot · Données hébergées localement · Aucune donnée ne quitte cette instance · RGPD & IA Act
        </footer>
      </div>
    </div>
  );
}
