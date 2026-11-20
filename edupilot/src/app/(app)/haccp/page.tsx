import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { haccpChecks, schools } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDay, isoDay } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertStrip, EmptyState, PageHeader } from "@/components/ui/misc";
import { CheckForm } from "@/components/haccp/check-form";
import { AlertTriangle, CalendarClock, CheckCircle2, ShieldCheck, Thermometer } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "HACCP" };

const TYPE_LABELS: Record<string, string> = {
  RECEPTION: "Réception", STOCKAGE: "Stockage", CUISSE: "Cuisson", NETTOYAGE: "Nettoyage",
};

export default async function HaccpPage() {
  const user = await requirePermission("haccp:read");
  const orgSchools = await db.select().from(schools).where(eq(schools.organizationId, user.organizationId));
  const checks = await db.select({ check: haccpChecks, school: schools.name })
    .from(haccpChecks).innerJoin(schools, eq(schools.id, haccpChecks.schoolId))
    .where(and(eq(haccpChecks.organizationId, user.organizationId), gte(haccpChecks.date, isoDay(-13))))
    .orderBy(desc(haccpChecks.date)).limit(80);
  const nonConform = checks.filter((c) => !c.check.conform);
  const dlcWarnings = checks.filter((c) => c.check.dlc && c.check.dlc <= isoDay(2) && c.check.date >= isoDay(-2));
  const canWrite = can(user.role, "haccp:write");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Qualité & sécurité alimentaire"
        title="HACCP Lite"
        description="Checklists journalières, températures, DLC et suivi des non-conformités — données conservées sur l'instance."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Contrôles (14 j)", value: checks.length, icon: ShieldCheck, tone: "bg-navy-100 text-navy-700" },
          { label: "Non-conformités", value: nonConform.length, icon: AlertTriangle, tone: "bg-red-100 text-red-700" },
          { label: "DLC à surveiller", value: dlcWarnings.length, icon: CalendarClock, tone: "bg-amber-100 text-amber-700" },
        ].map((kpi) => (
          <Card key={kpi.label} className="flex items-center gap-4 p-5">
            <span className={`grid size-11 place-items-center rounded-xl ${kpi.tone}`}><kpi.icon className="size-5" /></span>
            <div><p className="label-caps">{kpi.label}</p><p className="mt-1 text-2xl font-black">{kpi.value}</p></div>
          </Card>
        ))}
      </div>

      {nonConform.length > 0 && (
        <AlertStrip variant="danger" title={`${nonConform.length} non-conformité(s) à traiter :`}>
          chaque écart est tracé dans le journal d&apos;audit et remonte dans le centre d&apos;alertes.
        </AlertStrip>
      )}

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Nouveau contrôle</CardTitle><p className="text-xs text-muted-foreground">Checklist du jour par établissement</p></CardHeader>
          <CardContent>{canWrite ? <CheckForm schools={orgSchools.map((s) => ({ id: s.id, name: s.name }))} /> : <EmptyState title="Lecture seule" description="Votre rôle ne permet pas la saisie." />}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Historique des contrôles</CardTitle><p className="text-xs text-muted-foreground">14 derniers jours · tous établissements</p></CardHeader>
          <CardContent className="space-y-2">
            {checks.slice(0, 20).map(({ check, school }) => (
              <div key={check.id} className={`rounded-xl border p-3 ${check.conform ? "border-border/70 bg-white" : "border-red-200 bg-red-50/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy-900">{school}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDay(check.date)} · {TYPE_LABELS[check.checkType]}</p>
                  </div>
                  <Badge variant={check.conform ? "success" : "danger"}>
                    {check.conform ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                    {check.conform ? "Conforme" : "Écart"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {check.temperature !== null && <span className="flex items-center gap-1"><Thermometer className="size-3.5" /> {check.temperature} °C</span>}
                  {check.productLabel && <span>{check.productLabel}</span>}
                  {check.dlc && <span className={check.dlc <= isoDay(2) ? "font-bold text-amber-600" : ""}>DLC {formatDay(check.dlc)}</span>}
                </div>
                {check.note && <p className="mt-1 text-xs italic text-muted-foreground">{check.note}</p>}
              </div>
            ))}
            {checks.length === 0 && <EmptyState icon={ShieldCheck} title="Aucun contrôle" description="Saisissez le premier contrôle HACCP." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
