import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { planningShifts, schools, staff, timeClocks } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDay, isoDay, num } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertStrip, EmptyState, PageHeader } from "@/components/ui/misc";
import { ClockButton } from "@/components/planning/clock-button";
import { ShiftDialog } from "@/components/planning/shift-dialog";
import { CalendarDays, Clock3, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planning & pointage" };

const STATUS = {
  PLANNED: { label: "Prévu", variant: "default" as const },
  CLOCKED_IN: { label: "Présent", variant: "success" as const },
  CLOCKED_OUT: { label: "Terminé", variant: "outline" as const },
};

export default async function PlanningPage() {
  const user = await requirePermission("planning:read");
  const orgSchools = await db.select().from(schools).where(eq(schools.organizationId, user.organizationId));
  const orgStaff = await db.select().from(staff).where(eq(staff.organizationId, user.organizationId));
  const rows = await db.select({ shift: planningShifts, staff: staff, school: schools.name })
    .from(planningShifts)
    .innerJoin(staff, eq(staff.id, planningShifts.staffId))
    .innerJoin(schools, eq(schools.id, planningShifts.schoolId))
    .where(and(eq(planningShifts.organizationId, user.organizationId), gte(planningShifts.date, isoDay(0))))
    .orderBy(asc(planningShifts.date), asc(planningShifts.startHour)).limit(100);
  const clocks = await db.select().from(timeClocks).where(eq(timeClocks.organizationId, user.organizationId));
  const clockMap = new Map(clocks.map((c) => [c.shiftId, c]));
  const canWrite = can(user.role, "planning:write");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ressources humaines"
        title="Planning & pointage"
        description="Affectation des agents selon les couverts prévus par l'IA et pointage simple des présences."
        actions={canWrite ? <ShiftDialog
          staff={orgStaff.map((s) => ({ id: s.id, label: `${s.firstName} ${s.lastName} · ${s.position}` }))}
          schools={orgSchools.map((s) => ({ id: s.id, name: s.name }))}
        /> : undefined}
      />

      <AlertStrip variant="info" title="Prévisions connectées :">
        le nombre de couverts de chaque poste reprend la suggestion IA correspondante, sans déclencher de décision automatique.
      </AlertStrip>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Postes planifiés", value: rows.length, icon: CalendarDays, tone: "bg-navy-100 text-navy-700" },
          { label: "Présences pointées", value: rows.filter((r) => r.shift.status !== "PLANNED").length, icon: Clock3, tone: "bg-emerald-100 text-emerald-700" },
          { label: "Couverts couverts", value: num(rows.reduce((sum, r) => sum + r.shift.expectedCovers, 0)), icon: Users, tone: "bg-amber-100 text-amber-700" },
        ].map((kpi) => (
          <Card key={kpi.label} className="flex items-center gap-4 p-5">
            <span className={`grid size-11 place-items-center rounded-xl ${kpi.tone}`}><kpi.icon className="size-5" /></span>
            <div><p className="label-caps">{kpi.label}</p><p className="mt-1 text-2xl font-black">{kpi.value}</p></div>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle>7 prochains jours</CardTitle><p className="text-xs text-muted-foreground">Pointage depuis le terminal de cuisine ou le mobile des agents</p></CardHeader>
        <CardContent>
          {rows.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>{["Date", "Agent", "Établissement", "Horaires", "Couverts IA", "Statut", "Pointage"].map((h) => <th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border/70 bg-white">
                  {rows.map(({ shift, staff: member, school }) => {
                    const clock = clockMap.get(shift.id);
                    return (
                      <tr key={shift.id}>
                        <td className="px-3 py-3 font-semibold">{formatDay(shift.date, { weekday: "short" })}</td>
                        <td className="px-3 py-3">{member.firstName} {member.lastName}</td>
                        <td className="px-3 py-3 text-xs">{school}</td>
                        <td className="px-3 py-3 text-xs tabular-nums">{shift.startHour} – {shift.endHour}</td>
                        <td className="px-3 py-3 font-bold tabular-nums">{shift.expectedCovers}</td>
                        <td className="px-3 py-3"><Badge variant={STATUS[shift.status].variant}>{STATUS[shift.status].label}</Badge></td>
                        <td className="px-3 py-3">
                          {canWrite ? (
                            <div className="flex gap-1">
                              {!clock && <ClockButton shiftId={shift.id} action="IN" label="Arrivée" />}
                              {clock && !clock.clockOut && <ClockButton shiftId={shift.id} action="OUT" label="Départ" />}
                              {clock?.clockOut && <span className="text-xs text-muted-foreground">Terminé</span>}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">Lecture seule</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={CalendarDays} title="Aucun poste planifié" description="Ajoutez un poste pour commencer." />}
        </CardContent>
      </Card>
    </div>
  );
}
