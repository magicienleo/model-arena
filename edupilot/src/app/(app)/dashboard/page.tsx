import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, Bot, CalendarClock, CheckCircle2,
  Download, FileSpreadsheet, HandHeart, UtensilsCrossed, Sparkles, TrendingUp, TriangleAlert,
  Wallet,
} from "lucide-react";
import { getDashboardData } from "@/lib/queries";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDay, money, num, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/misc";
import { AttendanceChart, BudgetChart, ForecastChart, WasteChart } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tableau de bord" };

const SEVERITY = {
  CRITICAL: { label: "Critique", style: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  WARNING: { label: "Attention", style: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  INFO: { label: "Info", style: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
} as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.organizationId);
  if (!data) {
    return <EmptyState title="Aucune école configurée" description="Créez une école depuis l'administration pour afficher le tableau de bord." />;
  }
  const { kpis } = data;
  const firstName = (user.name ?? "Directeur").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const kpiCards = [
    {
      label: "Couverts prévus aujourd'hui",
      value: num(kpis.predictedToday),
      sub: `${num(kpis.actualToday)} réels hier`,
      icon: UtensilsCrossed,
      tone: "from-blue-500 to-navy-700",
      delta: kpis.attendanceDelta,
    },
    {
      label: "Taux de pertes",
      value: pct(kpis.wastePercent / 100),
      sub: `${money(kpis.wasteCost)} de pertes sur 10 j`,
      icon: TrendingUp,
      tone: "from-amber-400 to-orange-500",
      delta: null,
    },
    {
      label: "Budget consommé",
      value: pct(kpis.budgetPercent / 100),
      sub: `${money(kpis.budgetSpent)} / ${money(kpis.budget)}`,
      icon: Wallet,
      tone: "from-emerald-500 to-teal-700",
      delta: null,
    },
    {
      label: "Aides en attente",
      value: num(kpis.openAids),
      sub: `${num(kpis.totalAids)} dossiers au total`,
      icon: HandHeart,
      tone: "from-violet-500 to-purple-700",
      delta: null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vue de direction"
        title={`${greeting}, ${firstName} 👋`}
        description={`Voici la situation de la ${data.org?.name ?? "Caisse des Écoles"} et les points d'attention du jour.`}
        actions={can(user.role, "export:write") ? (
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/export?type=csv"><FileSpreadsheet className="size-4" /> Export CSV</a>
            </Button>
            <Button asChild size="sm">
              <a href="/api/export?type=pdf&doc=crc"><Download className="size-4" /> Rapport CRC (PDF)</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/export?type=pdf&doc=m14"><Download className="size-4" /> État M14</a>
            </Button>
          </>
        ) : undefined}
      />

      {/* Bandeau héro */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-800 to-[#1649a3] p-6 text-white shadow-lift sm:p-8">
        <div className="grid-pattern absolute inset-0 opacity-60" />
        <div className="absolute -right-16 -top-24 size-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
              <CalendarClock className="size-3.5" /> {data.schools} écoles · {num(data.children)} enfants suivis · {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}
            </div>
            <h2 className="max-w-xl text-2xl font-black leading-tight sm:text-[32px]">
              Votre restauration est <span className="text-amber-300">prête pour 7 jours</span>.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy-100">
              Le modèle a calculé {num(kpis.predictedToday)} couverts aujourd&apos;hui. {kpis.alerts > 0 ? `${kpis.alerts} point(s) d'attention nécessitent votre arbitrage.` : "Aucune alerte critique en cours."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="accent">
                <Link href="/predictions"><Sparkles className="size-4" /> Valider les prévisions IA</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href="/aides">Traiter les aides <ArrowRight className="size-4" /></Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            {[
              { label: "Exactitude IA", value: kpis.accuracy ? `${Math.max(0, 100 - kpis.accuracy.mape).toFixed(0)} %` : "—", hint: "écart moyen mesuré" },
              { label: "Aides validées", value: money(kpis.aidAmount), hint: `${kpis.aidDelay} j de délai moyen` },
              { label: "Alertes ouvertes", value: num(kpis.alerts), hint: kpis.haccpIssues ? `${kpis.haccpIssues} anomaly HACCP` : "aucune anomalie HACCP" },
              { label: "Écoles pilotes", value: num(data.schools), hint: "Fort-de-France & Lamentin" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
                <p className="text-[11px] font-semibold text-navy-200">{item.label}</p>
                <p className="mt-1 text-2xl font-black">{item.value}</p>
                <p className="mt-0.5 text-[10px] text-navy-300">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Card key={kpi.label} className="animate-fade-up surface-hover p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="label-caps">{kpi.label}</p>
                <p className="mt-3 text-[32px] font-black leading-none tracking-tight text-navy-950">{kpi.value}</p>
              </div>
              <span className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${kpi.tone} text-white shadow-md`}>
                <kpi.icon className="size-5" />
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
              <span className="text-[11px] text-muted-foreground">{kpi.sub}</span>
              {kpi.delta !== null ? (
                <span className={`flex items-center gap-1 text-xs font-bold ${kpi.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {kpi.delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {Math.abs(kpi.delta).toFixed(1).replace(".", ",")} %
                </span>
              ) : <Badge variant="outline" className="text-[10px]"> temps réel</Badge>}
            </div>
          </Card>
        ))}
      </section>

      {/* Graphiques */}
      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Fréquentation réelle</CardTitle><p className="text-xs text-muted-foreground">14 derniers jours · tous établissements confondus</p></div>
            <Badge variant="success"><span className="size-1.5 rounded-full bg-emerald-500" /> Données à jour</Badge>
          </CardHeader>
          <CardContent><AttendanceChart data={data.attendanceSeries} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Prévision 7 jours</CardTitle><p className="text-xs text-muted-foreground">Suggestions IA non encore validées</p></div>
            <Badge variant="ai"><Bot className="size-3" /> IA</Badge>
          </CardHeader>
          <CardContent><ForecastChart data={data.forecastSeries} /></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pertes alimentaires</CardTitle><p className="text-xs text-muted-foreground">Évolution du taux de pertes · seuil d&apos;alerte 12 %</p></CardHeader>
          <CardContent><WasteChart data={data.wasteSeries} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Consommation budgétaire</CardTitle><p className="text-xs text-muted-foreground">Comparaison mensuelle · exercice en cours</p></CardHeader>
          <CardContent>
            <BudgetChart data={data.budgetSeries} />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Enveloppe annuelle : {money(kpis.budget)}</span>
              <span className="font-bold text-navy-900">{pct(kpis.budgetPercent / 100)} consommés</span>
            </div>
            <ProgressBar value={kpis.budgetPercent} className="mt-2" tone={kpis.budgetPercent > 85 ? "danger" : "primary"} />
          </CardContent>
        </Card>
      </section>

      {/* Alertes + prévisions */}
      <section className="grid gap-5 xl:grid-cols-[1fr_1.15fr]" id="alertes">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><BellRing className="size-4 text-amber-500" /> Centre d&apos;alertes</CardTitle><p className="text-xs text-muted-foreground">Points nécessitant votre attention</p></div>
            <Badge variant="warning">{kpis.alerts} ouvertes</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aucune alerte ouverte" description="Tous les indicateurs sont dans les seuils paramétrés." />
            ) : data.alerts.map((alert) => {
              const sev = SEVERITY[alert.severity];
              return (
                <Link key={alert.id} href={alert.link ?? "/dashboard"} className="focus-ring flex gap-3 rounded-xl border border-border/70 p-3 transition hover:border-navy-200 hover:bg-navy-50/50">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${sev.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-navy-900">{alert.title}</p>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${sev.style}`}>{sev.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{alert.message}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-violet-600" /> Prévisions à confirmer</CardTitle><p className="text-xs text-muted-foreground">Validation humaine obligatoire avant commande</p></div>
            <Button asChild variant="ghost" size="sm"><Link href="/predictions">Tout voir <ArrowRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.predictions.filter((p) => p.pred.status === "SUGGESTED").slice(0, 6).map(({ pred, school }) => (
              <Link key={pred.id} href={`/predictions/${pred.id}`} className="focus-ring flex items-center gap-3 rounded-xl border border-border/70 p-3 transition hover:border-violet-200 hover:bg-violet-50/40">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Bot className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900">{school}</p>
                  <p className="text-xs text-muted-foreground">{formatDay(pred.date)} · {pred.predictedCovers} couverts · confiance {pct(pred.confidence, 0)}</p>
                </div>
                <Badge variant="warning">À valider</Badge>
              </Link>
            ))}
            {data.predictions.every((p) => p.pred.status !== "SUGGESTED") && (
              <EmptyState icon={CheckCircle2} title="Toutes les prévisions sont validées" description="Revenez demain pour les nouvelles suggestions." />
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="bg-gradient-to-r from-navy-900 to-navy-800 text-white">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-bold">Conformité IA Act & RGPD</p>
              <p className="text-sm text-navy-200">Chaque suggestion IA et chaque décision humaine sont horodatées dans le journal d&apos;audit local.</p>
            </div>
          </div>
          <Button asChild variant="accent" size="sm"><Link href="/admin#audit">Consulter l&apos;audit <ArrowRight className="size-4" /></Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
