import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getPredictionPageData } from "@/lib/queries";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDay, num, pct } from "@/lib/utils";
import { AiNotice, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsShell } from "@/components/ui/tabs-shell";
import { PredictionGenerator } from "@/components/predictions/prediction-generator";
import { PredictionsTable } from "@/components/predictions/predictions-table";
import { WasteForm } from "@/components/predictions/waste-form";
import { AccuracyChart } from "@/components/predictions/accuracy-chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "IA Restauration" };

export default async function PredictionsPage() {
  const user = await requirePermission("predictions:read");
  const data = await getPredictionPageData(user.organizationId);
  const orgSchools = await db.select({ id: schools.id, name: schools.name })
    .from(schools).where(eq(schools.organizationId, user.organizationId)).orderBy(schools.name);
  const pending = data.rows.filter((r) => r.pred.status === "SUGGESTED");
  const validated = data.rows.filter((r) => r.pred.status !== "SUGGESTED");
  const accuracy = data.accuracy;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence artificielle supervisée"
        title="IA Restauration"
        description="Prévisions de couverts, recommandations de commandes et suivi des pertes. Chaque suggestion doit être validée par un agent."
        actions={<PredictionGenerator canGenerate={can(user.role, "predictions:generate")} />}
      />

      <AiNotice>
        Les prévisions sont produites par un modèle statistique local entraîné sur 90 jours d&apos;historique.
        Elles ne déclenchent aucune commande automatique.
      </AiNotice>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Écart moyen (MAE)", value: accuracy.count ? `${accuracy.mae.toFixed(1).replace(".", ",")} couverts` : "—", hint: `${accuracy.count} comparaisons`, color: "text-primary" },
          { label: "Erreur relatives (MAPE)", value: accuracy.count ? `${accuracy.mape.toFixed(1).replace(".", ",")} %` : "—", hint: "sur les prévisions passées", color: "text-violet-600" },
          { label: "Dans l'intervalle", value: accuracy.count ? `${accuracy.withinInterval} %` : "—", hint: "fiabilité des bornes", color: "text-emerald-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-5">
            <p className="label-caps">{kpi.label}</p>
            <p className={`mt-2 text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.hint}</p>
          </Card>
        ))}
      </section>

      <TabsShell
        defaultValue="a-valider"
        tabs={[
          {
            value: "a-valider",
            label: "À valider",
            badge: String(pending.length),
            content: (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div><CardTitle>Suggestions en attente de décision</CardTitle><p className="text-xs text-muted-foreground">Cliquez sur une ligne pour ajuster puis valider</p></div>
                  <Badge variant="ai">Modèle edupilot-ts-v1</Badge>
                </CardHeader>
                <CardContent>
                  {pending.length ? <PredictionsTable rows={pending} /> : (
                    <EmptyState title="Tout est à jour" description="Aucune suggestion en attente. Recalculez les prévisions pour la période suivante." />
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            value: "validees",
            label: "Décisions prises",
            badge: String(validated.length),
            content: (
              <Card>
                <CardHeader><CardTitle>Historique des décisions humaines</CardTitle><p className="text-xs text-muted-foreground">Suggestion IA vs décision finale — trace auditable</p></CardHeader>
                <CardContent>
                  {data.validations.length ? (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <tr>{["Date", "Établissement", "IA", "Humain", "Écart", "Validateur"].map((h) => <th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-border/70 bg-white">
                          {data.validations.map(({ validation, prediction, school, validator }) => (
                            <tr key={validation.id}>
                              <td className="px-3 py-3 text-xs">{formatDay(prediction.date)}</td>
                              <td className="px-3 py-3">{school}</td>
                              <td className="px-3 py-3 tabular-nums">{validation.aiCovers} couverts</td>
                              <td className="px-3 py-3 font-bold tabular-nums">{validation.humanCovers} couverts</td>
                              <td className={`px-3 py-3 font-semibold ${validation.deltaCovers >= 0 ? "text-emerald-600" : "text-red-600"}`}>{validation.deltaCovers > 0 ? "+" : ""}{validation.deltaCovers}</td>
                              <td className="px-3 py-3 text-xs">{validator}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState title="Aucune décision enregistrée" description="Les validations apparaîtront ici avec l'écart humain/IA." />}
                </CardContent>
              </Card>
            ),
          },
          {
            value: "exactitude",
            label: "Exactitude",
            content: (
              <Card>
                <CardHeader><CardTitle>Prévisions vs réalité</CardTitle><p className="text-xs text-muted-foreground">Suivi de la qualité du modèle dans le temps</p></CardHeader>
                <CardContent>
                  <AccuracyChart accuracy={accuracy} />
                  <div className="mt-4 rounded-xl bg-navy-50 p-4 text-xs leading-relaxed text-navy-800">
                    <strong>Comment est calculée la prévision ?</strong> moyenne mobile 7 jours, effet jour de semaine,
                    tendance par régression linéaire sur 28 jours, événements du calendrier martiniquais
                    (Carnaval, congés) et température estimée. Le modèle tourne entièrement dans le processus Node.
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            value: "pertes",
            label: "Pertes alimentaires",
            content: (
              <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                <Card>
                  <CardHeader><CardTitle>Saisir un relevé de pertes</CardTitle><p className="text-xs text-muted-foreground">Une alerte est créée automatiquement au-delà du seuil de la caisse</p></CardHeader>
                  <CardContent>
                    {can(user.role, "waste:write") ? <WasteForm schools={orgSchools} defaultSchoolId={orgSchools[0]?.id} /> : (
                      <EmptyState title="Lecture seule" description="Votre rôle ne permet pas la saisie de relevés." />
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Derniers relevés</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {data.wasteLast.slice(0, 8).map((w) => {
                      const school = orgSchools.find((s) => s.id === w.schoolId);
                      return (
                        <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-navy-900">{school?.name ?? "Établissement"}</p>
                            <p className="text-xs text-muted-foreground">{formatDay(w.date)} · {num(w.covers)} couverts</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{w.wasteKg} kg</p>
                            <p className="text-xs text-muted-foreground">{pct(w.preparedMeals ? w.wasteKg / (w.preparedMeals * 0.38) : 0, 0)}</p>
                          </div>
                        </div>
                      );
                    })}
                    {!data.wasteLast.length && <EmptyState title="Aucun relevé" description="Saisissez le premier relevé de pertes." />}
                  </CardContent>
                </Card>
              </div>
            ),
          },
        ]}
      />

      <div className="text-center text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">← Retour au tableau de bord</Link>
      </div>
    </div>
  );
}
