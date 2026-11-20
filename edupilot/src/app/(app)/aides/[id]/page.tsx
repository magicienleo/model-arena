import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aidDocuments, aidRequests, aidValidations, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDateTime, money, num } from "@/lib/utils";
import { PageHeader, ProgressBar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreButton } from "@/components/aides/score-button";
import { DocumentUpload } from "@/components/aides/document-upload";
import { AidValidationForm } from "@/components/aides/aid-validation-form";
import { ArrowLeft, Bot, CheckCircle2, Download, FileText, ShieldCheck, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossier d'aide" };

const STATUS = {
  DEPOSITED: { label: "Déposé", variant: "default" as const },
  SCORED: { label: "À valider", variant: "warning" as const },
  VALIDATED: { label: "Validé", variant: "success" as const },
  REJECTED: { label: "Refusé", variant: "danger" as const },
};

export default async function AidDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("aides:read");
  const { id } = await params;
  const [aid] = await db.select().from(aidRequests)
    .where(and(eq(aidRequests.id, id), eq(aidRequests.organizationId, user.organizationId))).limit(1);
  if (!aid) notFound();
  const docs = await db.select().from(aidDocuments).where(eq(aidDocuments.aidRequestId, aid.id));
  const [trace] = await db.select({ validation: aidValidations, validator: users.name })
    .from(aidValidations).innerJoin(users, eq(users.id, aidValidations.validatorId))
    .where(eq(aidValidations.aidRequestId, aid.id)).limit(1);
  const canScore = can(user.role, "aides:score");
  const canValidate = can(user.role, "aides:validate");

  return (
    <div className="space-y-6">
      <Link href="/aides" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Retour aux aides</Link>
      <PageHeader
        eyebrow={aid.reference}
        title={aid.applicantName}
        description={`Déposée le ${formatDateTime(aid.depositedAt)} · source ${aid.source}`}
        actions={<Badge variant={STATUS[aid.status].variant} className="text-sm">{STATUS[aid.status].label}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_.95fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Informations du dossier</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                ["Quotient familial", num(aid.quotientFamilial)],
                ["Montant demandé", money(aid.amountAsked)],
                ["Motif", aid.reason],
                ["Pièces jointes", `${docs.length} fichier(s)`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/50 p-3">
                  <p className="label-caps">{label}</p><p className="mt-1 text-sm font-bold text-navy-900">{value}</p>
                </div>
              ))}
              {aid.ocrPayload && (
                <div className="sm:col-span-2 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold text-violet-800"><Bot className="size-4" /> Extraction OCR simulée (locale)</p>
                  <pre className="overflow-x-auto text-[11px] leading-relaxed text-violet-900">{JSON.stringify(aid.ocrPayload, null, 2)}</pre>
                  <p className="mt-2 text-[10px] text-violet-700">P1 · OCR avancé non implémenté — stub déterministe.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pièces justificatives</CardTitle><p className="text-xs text-muted-foreground">Fichiers stockés dans ./uploads — aucune donnée externe</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <FileText className="size-5 text-primary" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{doc.fileName}</p><p className="text-[11px] text-muted-foreground">{Math.round(doc.size / 1024)} Ko · {formatDateTime(doc.uploadedAt)}</p></div>
                    <Badge variant="success">OCR</Badge>
                  </div>
                ))}
                {docs.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Aucune pièce jointe</p>}
              </div>
              {canScore && aid.status === "DEPOSITED" && <DocumentUpload aidId={aid.id} />}
            </CardContent>
          </Card>

          {trace && (
            <Card className="border-emerald-200">
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> Décision humaine tracée</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Suggestion IA</span><strong>{money(trace.validation.aiAmount)}</strong></div>
                <div className="flex justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Décision retenue</span><strong className="text-emerald-700">{money(trace.validation.humanAmount)}</strong></div>
                <div className="flex justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">Décision</span><strong>{trace.validation.decision === "APPROVED" ? "Accordée" : "Refusée"}</strong></div>
                <p className="text-xs text-muted-foreground">{trace.validator} · {formatDateTime(trace.validation.decidedAt)}</p>
                <p className="rounded-lg bg-muted/60 p-3 text-xs"><strong>Motif :</strong> {trace.validation.reason}</p>
                {aid.status === "VALIDATED" && (
                  <Button asChild className="w-full"><a href={`/api/attestation/${aid.id}`} target="_blank"><Download className="size-4" /> Télécharger l&apos;attestation PDF</a></Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="border-violet-200 bg-gradient-to-br from-white to-violet-50">
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Bot className="size-4 text-violet-600" /> Scoring IA</CardTitle><p className="text-xs text-muted-foreground">Règles publiques + modèle linéaire local</p></div>
              {aid.score !== null && <Badge variant="ai" className="text-base font-black">{aid.score}/100</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              {aid.score !== null ? (
                <>
                  <div>
                    <div className="mb-1 flex justify-between text-xs font-semibold"><span className="text-muted-foreground">Score de priorité</span><span>{aid.score} / 100</span></div>
                    <ProgressBar value={aid.score} tone="primary" />
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <p className="label-caps">Montant suggéré</p>
                    <p className="mt-1 text-3xl font-black text-navy-950">{money(aid.suggestedAmount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">demandé : {money(aid.amountAsked)}</p>
                  </div>
                  <div className="space-y-2">
                    {aid.scoreExplanation?.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className={`font-bold ${item.points > 0 ? "text-emerald-600" : "text-red-600"}`}>+{item.points} pts</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-white/70 p-5 text-center">
                  <p className="text-sm font-semibold text-navy-900">Aucun score calculé</p>
                  <p className="mt-1 text-xs text-muted-foreground">Le scoring est requis avant toute décision humaine.</p>
                </div>
              )}
              {aid.status === "DEPOSITED" && canScore && <ScoreButton aidId={aid.id} />}
              {!canScore && <p className="text-xs text-muted-foreground">Votre rôle ne permet pas le scoring.</p>}
            </CardContent>
          </Card>

          {aid.status === "SCORED" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> Validation humaine</CardTitle></CardHeader>
              <CardContent>{canValidate ? (
                <AidValidationForm aidId={aid.id} suggestedAmount={aid.suggestedAmount ?? 0} />
              ) : (
                <p className="text-sm text-muted-foreground">Seuls les agents habilités aux aides sociales peuvent décider.</p>
              )}</CardContent>
            </Card>
          )}

          {aid.status === "VALIDATED" && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" /><div><strong>Aide accordée.</strong> L&apos;attestation PDF est générée localement, sans service externe.</div>
            </div>
          )}
          {aid.status === "REJECTED" && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><XCircle className="mt-0.5 size-5 shrink-0" /><strong>Demande refusée par décision humaine.</strong></div>
          )}
        </div>
      </div>
    </div>
  );
}
