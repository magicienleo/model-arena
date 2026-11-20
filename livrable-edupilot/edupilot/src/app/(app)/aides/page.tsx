import Link from "next/link";
import { HandHeart, Clock3, CheckCircle2, XCircle, Wallet, ArrowRight, FileText } from "lucide-react";
import { db } from "@/db";
import { families } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAidPageData } from "@/lib/queries";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDateTime, money, num } from "@/lib/utils";
import { AiNotice, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewAidDialog } from "@/components/aides/new-aid-dialog";
import { ScoreButton } from "@/components/aides/score-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aides sociales" };

const COLUMNS = [
  { status: "DEPOSITED", label: "Déposé", icon: FileText, tone: "border-t-slate-400", badge: "default" as const },
  { status: "SCORED", label: "Scoré · à valider", icon: Clock3, tone: "border-t-violet-500", badge: "ai" as const },
  { status: "VALIDATED", label: "Validé", icon: CheckCircle2, tone: "border-t-emerald-500", badge: "success" as const },
  { status: "REJECTED", label: "Refusé", icon: XCircle, tone: "border-t-red-400", badge: "danger" as const },
];

export default async function AidesPage() {
  const user = await requirePermission("aides:read");
  const rows = await getAidPageData(user.organizationId);
  const familyOptions = (await db.select().from(families)
    .where(eq(families.organizationId, user.organizationId)).limit(80))
    .map((f) => ({ id: f.id, label: `${f.firstName} ${f.lastName}`, quotientFamilial: f.quotientFamilial }));

  const validated = rows.filter((r) => r.aid.status === "VALIDATED");
  const totalAmount = validated.reduce((sum, r) => sum + (r.aid.finalAmount ?? 0), 0);
  const delays = validated.map((r) => (r.aid.decidedAt?.getTime() ?? r.aid.depositedAt.getTime()) - r.aid.depositedAt.getTime());
  const avgDelay = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length / 86_400_000 * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Action sociale"
        title="Aides sociales digitales"
        description="Dépôt, scoring explicable, validation humaine obligatoire et attestation. Aucune aide n'est accordée automatiquement."
        actions={<NewAidDialog families={familyOptions} />}
      />

      <AiNotice>
        Le score proposé est une aide à la décision. L&apos;agent habilité doit vérifier les pièces et rendre une décision motivée.
      </AiNotice>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Dossiers traités", value: num(rows.length), hint: `${rows.filter((r) => r.aid.status === "DEPOSITED").length} en attente de scoring`, icon: HandHeart, color: "bg-navy-100 text-navy-700" },
          { label: "Délai moyen", value: `${avgDelay.toFixed(1).replace(".", ",")} j`, hint: "dépôt → décision", icon: Clock3, color: "bg-amber-100 text-amber-700" },
          { label: "Montant accordé", value: money(totalAmount), hint: "sur l'exercice en cours", icon: Wallet, color: "bg-emerald-100 text-emerald-700" },
          { label: "Taux d'acceptation", value: rows.length ? `${Math.round((validated.length / Math.max(1, rows.filter((r) => ["VALIDATED", "REJECTED"].includes(r.aid.status)).length)) * 100)} %` : "—", hint: "décisions humaines", icon: CheckCircle2, color: "bg-violet-100 text-violet-700" },
        ].map((kpi) => (
          <Card key={kpi.label} className="flex items-center gap-4 p-5">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${kpi.color}`}><kpi.icon className="size-5" /></span>
            <div><p className="label-caps">{kpi.label}</p><p className="mt-1 text-2xl font-black text-navy-950">{kpi.value}</p><p className="text-[11px] text-muted-foreground">{kpi.hint}</p></div>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const items = rows.filter((r) => r.aid.status === column.status);
          return (
            <section key={column.status} className={`rounded-2xl border border-border border-t-4 ${column.tone} bg-white/70 p-3`}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900"><column.icon className="size-4" /> {column.label}</h2>
                <Badge variant={column.badge}>{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.slice(0, 20).map(({ aid, family }) => (
                  <div key={aid.id} className="rounded-xl border border-border bg-white p-3 shadow-sm transition hover:border-navy-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-navy-900">{aid.applicantName}</p>
                        <p className="text-[11px] text-muted-foreground">{aid.reference} · QF {aid.quotientFamilial}</p>
                      </div>
                      {aid.score !== null && <Badge variant="ai">{aid.score}/100</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{aid.reason}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2">
                      <span className="text-xs font-bold text-navy-800">{money(aid.finalAmount ?? aid.suggestedAmount ?? aid.amountAsked)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(aid.depositedAt)}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Link href={`/aides/${aid.id}`} className="flex-1 rounded-lg bg-navy-50 px-2 py-1.5 text-center text-xs font-bold text-navy-800 hover:bg-navy-100">
                        Ouvrir le dossier
                      </Link>
                      {aid.status === "DEPOSITED" && can(user.role, "aides:score") && <ScoreButton aidId={aid.id} compact />}
                    </div>
                    {family && <p className="mt-2 truncate text-[10px] text-muted-foreground">Famille : {family.firstName} {family.lastName}</p>}
                  </div>
                ))}
                {items.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">Aucun dossier ici</p>}
              </div>
            </section>
          );
        })}
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-bold">Besoin d&apos;un état détaillé ?</p><p className="text-sm text-muted-foreground">Consultez les montants, délais et décisions dans le tableau de bord.</p></div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">Voir les statistiques <ArrowRight className="size-4" /></Link>
      </Card>
      {rows.length === 0 && <EmptyState icon={HandHeart} title="Aucune demande" description="Déposez la première demande d'aide." />}
    </div>
  );
}
