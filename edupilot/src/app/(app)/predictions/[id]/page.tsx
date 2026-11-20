import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { predictions, predictionValidations, schools, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDay, money, num, pct } from "@/lib/utils";
import { AiNotice, PageHeader, ProgressBar } from "@/components/ui/misc";
import { Badge, Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationForm } from "@/components/predictions/validation-form";
import { ArrowLeft, Bot, CheckCircle2, Clock3, Info, Scale, ShieldCheck, TrendingUp, UtensilsCrossed, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Validation d'une prévision" };

export default async function PredictionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("predictions:read");
  const { id } = await params;
  const [row] = await db.select({ pred: predictions, school: schools.name })
    .from(predictions).innerJoin(schools, eq(schools.id, predictions.schoolId))
    .where(and(eq(predictions.id, id), eq(predictions.organizationId, user.organizationId))).limit(1);
  if (!row) notFound();
  const { pred, school } = row;
  const [trace] = await db.select({ validation: predictionValidations, validator: users.name })
    .from(predictionValidations).innerJoin(users, eq(users.id, predictionValidations.validatorId))
    .where(eq(predictionValidations.predictionId, pred.id)).limit(1);
  const canValidate = can(user.role, "predictions:validate");

  return (
    <div className="space-y-6">
      <Link href="/predictions" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Retour aux prévisions
      </Link>
      <PageHeader
        eyebrow="Suggestion IA · décision humaine"
        title={`${school} — ${formatDay(pred.date, { weekday: "long" })}`}
        description={`Générée le ${new Date(pred.generatedAt).toLocaleString("fr-FR")} · modèle ${pred.modelVersion} · horizon ${pred.horizonDays} jours`}
        actions={<Badge variant={pred.status === "VALIDATED" ? "success" : pred.status === "REJECTED" ? "danger" : "warning"} className="text-sm">
          {pred.status === "VALIDATED" ? <><CheckCircle2 className="size-3.5" /> Validée</> : pred.status === "REJECTED" ? <><XCircle className="size-3.5" /> Rejetée</> : <><Clock3 className="size-3.5" /> À valider</>}
        </Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        {/* Suggestion IA */}
        <div className="space-y-5">
          <Card className="relative overflow-hidden border-violet-200 bg-gradient-to-br from-white via-white to-violet-50">
            <div className="absolute -right-12 -top-12 size-44 rounded-full bg-violet-200/40 blur-2xl" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2"><Bot className="size-4 text-violet-600" /> Suggestion du modèle</CardTitle>
              <p className="text-xs text-muted-foreground">Non exécutable sans validation humaine</p>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex flex-wrap items-end gap-8">
                <div>
                  <p className="label-caps">Couverts attendus</p>
                  <p className="mt-1 text-6xl font-black leading-none tracking-tight text-navy-950">{pred.predictedCovers}</p>
                  <p className="mt-2 text-sm text-muted-foreground">intervalle {pred.lowerBound} – {pred.upperBound}</p>
                </div>
                <div className="relative grid size-24 place-items-center rounded-full" style={{ background: `conic-gradient(#8b5cf6 ${pred.confidence * 100}%, #ede9fe 0)` }}>
                  <div className="grid size-[76px] place-items-center rounded-full bg-white text-center">
                    <div><p className="text-lg font-black text-violet-700">{pct(pred.confidence, 0)}</p><p className="text-[9px] uppercase tracking-wider text-muted-foreground">confiance</p></div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><UtensilsCrossed className="size-4" /> Repas recommandés</p>
                  <p className="mt-1 text-2xl font-black text-navy-900">{num(pred.recommendedMeals)}</p>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Scale className="size-4" /> Pertes estimées</p>
                  <p className="mt-1 text-2xl font-black text-amber-600">{pred.expectedWasteKg} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Explication de la prévision</CardTitle><p className="text-xs text-muted-foreground">Facteurs utilisés par le modèle, en points d&apos;impact</p></CardHeader>
            <CardContent className="space-y-3">
              {pred.features.map((feature) => (
                <div key={feature.label} className="grid grid-cols-[1fr_96px_46px] items-center gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{feature.label}</span>
                  <ProgressBar value={Math.min(100, Math.abs(feature.impact) * 3 + 12)} tone={feature.impact < 0 ? "danger" : "primary"} />
                  <span className={`text-right font-bold tabular-nums ${feature.impact < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {feature.impact > 0 ? "+" : ""}{feature.impact} pts
                  </span>
                </div>
              ))}
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Le modèle est transparent et reproductible : aucune donnée n&apos;est envoyée à un service externe.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Décision humaine */}
        <div className="space-y-5">
          {pred.status === "SUGGESTED" ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> Ajuster &amp; valider</CardTitle><p className="text-xs text-muted-foreground">Vous seul pouvez arrêter la quantité finale</p></CardHeader>
              <CardContent>{canValidate ? (
                <ValidationForm predictionId={pred.id} aiCovers={pred.predictedCovers} aiMeals={pred.recommendedMeals} />
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
                  Votre rôle permet la consultation mais pas la validation. Contactez un responsable restauration ou un directeur.
                </div>
              )}</CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> Décision enregistrée</CardTitle><p className="text-xs text-muted-foreground">Trace immuable suggestion IA / décision humaine</p></CardHeader>
              <CardContent className="space-y-4">
                {trace ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                        <p className="label-caps text-violet-700">IA suggérée</p>
                        <p className="mt-1 text-3xl font-black text-violet-900">{trace.validation.aiCovers}</p>
                        <p className="text-xs text-violet-700">{trace.validation.aiMeals} repas</p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="label-caps text-emerald-700">Humain retenu</p>
                        <p className="mt-1 text-3xl font-black text-emerald-900">{trace.validation.humanCovers}</p>
                        <p className="text-xs text-emerald-700">{trace.validation.humanMeals} repas</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-4 text-sm">
                      <p><strong>Validateur :</strong> {trace.validator}</p>
                      <p><strong>Écart :</strong> <span className={trace.validation.deltaCovers >= 0 ? "text-emerald-600" : "text-red-600"}>{trace.validation.deltaCovers > 0 ? "+" : ""}{trace.validation.deltaCovers} couverts</span></p>
                      {trace.validation.reason && <p className="mt-2"><strong>Motif :</strong> {trace.validation.reason}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">Décision du {new Date(trace.validation.decidedAt).toLocaleString("fr-FR")}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Décision enregistrée sans ajustement détaillé (données de démonstration).</p>
                )}
                <UiBadge variant="success" className="w-full justify-center py-2"><CheckCircle2 className="size-4" /> Audité dans le journal local</UiBadge>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Contexte de pilotage</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Établissement</span><strong>{school}</strong></div>
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Date</span><strong>{formatDay(pred.date, { weekday: "long" })}</strong></div>
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Coût estimé du repas</span><strong>{money(3.25)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Impact commande IA</span><strong>{money(pred.recommendedMeals * 3.25)}</strong></div>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link href="/admin#audit">Voir dans le journal d&apos;audit</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {!canValidate && pred.status === "SUGGESTED" && <AiNotice>Lecture seule : la validation humaine est réservée aux rôles autorisés.</AiNotice>}
    </div>
  );
}
