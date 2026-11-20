"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aidDocuments, aidRequests, aidValidations, alerts, families, organizations } from "@/db/schema";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { mockOcr, newAidReference, scoreAid } from "@/lib/ml/aid-score";
import { safeUploadPath } from "@/lib/env";
import { uid, todayISO } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

const MAX_UPLOAD = 5 * 1024 * 1024;

export async function createAidAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("aides:read");
    const parsed = z.object({
      familyId: z.string().optional(),
      applicantName: z.string().trim().min(2).max(120),
      quotientFamilial: z.coerce.number().int().min(0).max(10000),
      amountAsked: z.coerce.number().min(1).max(5000),
      reason: z.string().trim().min(2).max(240),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs de la demande." };
    const id = uid("aid");
    await db.insert(aidRequests).values({
      id, organizationId: user.organizationId,
      familyId: parsed.data.familyId || null,
      applicantName: parsed.data.applicantName,
      quotientFamilial: parsed.data.quotientFamilial,
      amountAsked: parsed.data.amountAsked,
      reason: parsed.data.reason,
      reference: newAidReference(),
      status: "DEPOSITED",
      source: "back-office",
    });
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "AID_DEPOSITED", entityType: "aid_request", entityId: id,
      humanDecision: parsed.data, detail: "Dépôt d'une demande d'aide — en attente de scoring",
    });
    revalidatePath("/aides");
    return { ok: true, message: "Demande enregistrée. Lancez le scoring IA pour obtenir une suggestion." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible d'enregistrer la demande." };
  }
}

export async function scoreAidAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("aides:score");
    const aidId = String(formData.get("aidId") ?? "");
    const [aid] = await db.select().from(aidRequests)
      .where(and(eq(aidRequests.id, aidId), eq(aidRequests.organizationId, user.organizationId))).limit(1);
    if (!aid) return { ok: false, message: "Demande introuvable." };
    if (aid.status !== "DEPOSITED" && aid.status !== "SCORED") return { ok: false, message: "Cette demande a déjà fait l'objet d'une décision." };
    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
    const [docs] = await db.select({ count: aidDocuments.id }).from(aidDocuments).where(eq(aidDocuments.aidRequestId, aid.id)).limit(1);
    const result = scoreAid({
      quotientFamilial: aid.quotientFamilial,
      childrenCount: 1,
      documentsComplete: !!docs,
      singleParent: aid.applicantName.toLowerCase().includes("mme"),
      urgencyDays: 10,
      amountAsked: aid.amountAsked,
      bareme: (org?.aidBareme ?? { base: 120, partQ1: 65, partQ2: 45, partQ3: 25, max: 380 }) as never,
    });
    await db.update(aidRequests).set({
      status: "SCORED", score: result.score, suggestedAmount: result.suggestedAmount,
      scoreExplanation: result.explanation,
    }).where(eq(aidRequests.id, aid.id));
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "AID_SCORED", entityType: "aid_request", entityId: aid.id,
      aiSuggestion: { score: result.score, amount: result.suggestedAmount, explanation: result.explanation },
      detail: "Score calculé localement — aucune décision automatique",
    });
    revalidatePath("/aides");
    revalidatePath(`/aides/${aid.id}`);
    return { ok: true, message: `Score ${result.score}/100 calculé — validation humaine requise.` };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Scoring impossible." };
  }
}

export async function uploadAidDocumentAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("aides:score");
    const aidId = String(formData.get("aidId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, message: "Sélectionnez un fichier." };
    if (file.size > MAX_UPLOAD) return { ok: false, message: "Fichier trop volumineux (5 Mo maximum)." };
    const allowed = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
    if (!allowed.includes(file.type)) return { ok: false, message: "Format non accepté (PDF, JPEG, PNG)." };

    const [aid] = await db.select().from(aidRequests)
      .where(and(eq(aidRequests.id, aidId), eq(aidRequests.organizationId, user.organizationId))).limit(1);
    if (!aid) return { ok: false, message: "Demande introuvable." };

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const relative = path.join("aides", user.organizationId, aid.id, `${uid("f")}-${safeName}`);
    const absolute = safeUploadPath(relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, Buffer.from(await file.arrayBuffer()));
    const ocr = mockOcr(file.name);
    await db.insert(aidDocuments).values({
      id: uid("doc"), organizationId: user.organizationId, aidRequestId: aid.id,
      fileName: safeName, storedPath: relative, mimeType: file.type, size: file.size,
      ocrText: JSON.stringify(ocr),
    });
    await db.update(aidRequests).set({ ocrPayload: ocr }).where(eq(aidRequests.id, aid.id));
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "AID_DOCUMENT_UPLOADED", entityType: "aid_request", entityId: aid.id,
      aiSuggestion: ocr, detail: `Fichier ${safeName} stocké localement (OCR simulé)`,
    });
    revalidatePath(`/aides/${aid.id}`);
    return { ok: true, message: "Pièce ajoutée. Données OCR simulées extraites localement." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Échec de l'upload." };
  }
}

export async function validateAidAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("aides:validate");
    const parsed = z.object({
      aidId: z.string().min(1),
      finalAmount: z.coerce.number().min(0).max(5000),
      reason: z.string().trim().min(3, "Indiquez le motif de la décision").max(500),
      decision: z.enum(["APPROVED", "REJECTED"]),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Renseignez un montant et un motif de décision." };

    const [aid] = await db.select().from(aidRequests)
      .where(and(eq(aidRequests.id, parsed.data.aidId), eq(aidRequests.organizationId, user.organizationId))).limit(1);
    if (!aid) return { ok: false, message: "Demande introuvable." };
    // HITL : on ne peut décider qu'après production d'un score IA explicable.
    if (aid.status !== "SCORED") return { ok: false, message: "Le scoring IA doit être effectué avant toute décision." };

    const decision = parsed.data.decision === "APPROVED" ? "VALIDATED" : "REJECTED";
    const aiSuggestion = { score: aid.score, suggestedAmount: aid.suggestedAmount, explanation: aid.scoreExplanation };
    await db.insert(aidValidations).values({
      id: uid("aval"), organizationId: user.organizationId, aidRequestId: aid.id, validatorId: user.id,
      decision: parsed.data.decision, aiAmount: aid.suggestedAmount ?? 0,
      humanAmount: decision === "VALIDATED" ? parsed.data.finalAmount : 0,
      reason: parsed.data.reason,
    });
    await db.update(aidRequests).set({
      status: decision,
      finalAmount: decision === "VALIDATED" ? parsed.data.finalAmount : 0,
      decidedAt: new Date(),
    }).where(eq(aidRequests.id, aid.id));
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "AID_VALIDATED", entityType: "aid_request", entityId: aid.id,
      aiSuggestion,
      humanDecision: { decision, amount: decision === "VALIDATED" ? parsed.data.finalAmount : 0, reason: parsed.data.reason },
      detail: "Décision humaine prise après scoring IA",
    });
    if (decision === "REJECTED") {
      await db.insert(alerts).values({
        id: uid("alert"), organizationId: user.organizationId, severity: "INFO", category: "AIDES",
        title: "Demande d'aide refusée", message: `${aid.reference} — ${parsed.data.reason}`,
        link: `/aides/${aid.id}`,
      });
    }
    revalidatePath("/aides");
    revalidatePath(`/aides/${aid.id}`);
    revalidatePath("/dashboard");
    return { ok: true, message: decision === "VALIDATED" ? "Aide validée et attestation disponible." : "Demande refusée et tracée." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Décision impossible." };
  }
}

export async function exportFamilyDataAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  const familyId = String(formData.get("familyId") ?? "");
  const [family] = await db.select().from(families).where(and(eq(families.id, familyId), eq(families.organizationId, session.user.organizationId))).limit(1);
  if (!family) return null;
  logAudit({
    organizationId: session.user.organizationId, actorId: session.user.id, actorName: session.user.name ?? "admin",
    action: "RGPD_EXPORT", entityType: "family", entityId: family.id, detail: "Export des données personnelles",
  });
  return { family, exportedAt: todayISO() };
}
