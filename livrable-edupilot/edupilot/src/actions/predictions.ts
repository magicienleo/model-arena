"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { alerts, attendance, organizations, predictions, predictionValidations, schools, wasteRecords } from "@/db/schema";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { forecast, trainModel } from "@/lib/ml/predict";
import { uid, todayISO } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

const validationSchema = z.object({
  predictionId: z.string().min(1),
  humanCovers: z.coerce.number().int().min(0).max(2000),
  humanMeals: z.coerce.number().int().min(0).max(3000),
  reason: z.string().max(500).optional(),
  decision: z.enum(["VALIDATE", "REJECT"]),
});

export async function generatePredictionsAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("predictions:generate");
    const days = formData.get("days") === "14" ? 14 : 7;
    const orgSchools = await db.select().from(schools).where(eq(schools.organizationId, user.organizationId));
    let created = 0;
    const start = new Date(`${todayISO()}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 1);

    for (const school of orgSchools) {
      const history = await db.select().from(attendance)
        .where(and(eq(attendance.organizationId, user.organizationId), eq(attendance.schoolId, school.id)))
        .orderBy(attendance.date);
      const model = trainModel(history.map(({ date, expected, covers }) => ({ date, expected, covers })));
      const latest = history.at(-1);
      const forecasts = forecast(history, model, start.toISOString().slice(0, 10), days, {
        expected: latest?.expected ?? school.capacity,
        wasteRate: 0.11,
      });
      for (const f of forecasts) {
        db.insert(predictions).values({
          id: uid("pred"),
          organizationId: user.organizationId,
          schoolId: school.id,
          date: f.date,
          generatedAt: new Date(),
          horizonDays: days,
          predictedCovers: f.covers,
          lowerBound: f.lower,
          upperBound: f.upper,
          confidence: f.confidence,
          recommendedMeals: f.recommendedMeals,
          expectedWasteKg: f.expectedWasteKg,
          features: f.features,
          modelVersion: model.version,
          status: "SUGGESTED",
        }).onConflictDoUpdate({
          target: [predictions.organizationId, predictions.schoolId, predictions.date],
          set: {
            predictedCovers: f.covers, lowerBound: f.lower, upperBound: f.upper,
            confidence: f.confidence, recommendedMeals: f.recommendedMeals,
            expectedWasteKg: f.expectedWasteKg, features: f.features,
            modelVersion: model.version, status: "SUGGESTED", generatedAt: new Date(),
          },
        }).run();
        created++;
      }
    }
    logAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name ?? "agent",
      action: "PREDICTION_GENERATED",
      entityType: "prediction_batch",
      entityId: `${todayISO()}-${days}j`,
      aiSuggestion: { days, schools: orgSchools.length },
      detail: `${created} suggestions recalculees sur ${orgSchools.length} etablissements`,
    });
    revalidatePath("/predictions");
    revalidatePath("/dashboard");
    return { ok: true, message: `${created} suggestions recalculées (${days} jours) — validation humaine requise.` };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de générer les prévisions." };
  }
}

export async function validatePredictionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("predictions:validate");
    const parsed = validationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Valeurs invalides (couverts et repas doivent être positifs)." };

    const [prediction] = await db.select().from(predictions)
      .where(and(eq(predictions.id, parsed.data.predictionId), eq(predictions.organizationId, user.organizationId))).limit(1);
    if (!prediction) return { ok: false, message: "Prévision introuvable." };
    if (prediction.status !== "SUGGESTED") return { ok: false, message: "Cette prévision a déjà fait l'objet d'une décision." };

    const decision = parsed.data.decision === "VALIDATE" ? "VALIDATED" : "REJECTED";
    const aiSuggestion = {
      covers: prediction.predictedCovers,
      meals: prediction.recommendedMeals,
      confidence: prediction.confidence,
      lower: prediction.lowerBound,
      upper: prediction.upperBound,
      model: prediction.modelVersion,
    };
    const humanDecision = decision === "VALIDATED"
      ? { covers: parsed.data.humanCovers, meals: parsed.data.humanMeals, reason: parsed.data.reason ?? "" }
      : { decision: "REJECTED", reason: parsed.data.reason ?? "" };

    await db.insert(predictionValidations).values({
      id: uid("pval"),
      organizationId: user.organizationId,
      predictionId: prediction.id,
      validatorId: user.id,
      aiCovers: prediction.predictedCovers,
      humanCovers: parsed.data.humanCovers,
      aiMeals: prediction.recommendedMeals,
      humanMeals: parsed.data.humanMeals,
      deltaCovers: parsed.data.humanCovers - prediction.predictedCovers,
      reason: parsed.data.reason ?? null,
    });
    await db.update(predictions).set({ status: decision }).where(eq(predictions.id, prediction.id));
    logAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name ?? "agent",
      action: decision === "VALIDATED" ? "PREDICTION_VALIDATED" : "PREDICTION_REJECTED",
      entityType: "prediction",
      entityId: prediction.id,
      aiSuggestion,
      humanDecision,
      detail: decision === "VALIDATED"
        ? `Écart humain : ${parsed.data.humanCovers - prediction.predictedCovers} couverts`
        : "Suggestion IA rejetée par l'agent humain",
    });
    if (decision === "REJECTED") {
      await db.insert(alerts).values({
        id: uid("alert"), organizationId: user.organizationId, severity: "INFO", category: "RESTAURATION",
        title: "Prévision IA rejetée", message: "Une suggestion a été écartée par le responsable restauration.",
        link: `/predictions/${prediction.id}`,
      });
    }
    revalidatePath("/predictions");
    revalidatePath(`/predictions/${prediction.id}`);
    revalidatePath("/dashboard");
    return { ok: true, message: decision === "VALIDATED" ? "Décision enregistrée et auditée." : "Suggestion rejetée et tracée." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function logWasteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("waste:write");
    const parsed = z.object({
      schoolId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      covers: z.coerce.number().int().min(0).max(3000),
      preparedMeals: z.coerce.number().int().min(0).max(3000),
      wasteKg: z.coerce.number().min(0).max(500),
      menuLabel: z.string().max(160).optional(),
      note: z.string().max(400).optional(),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs du relevé de pertes." };
    const [school] = await db.select().from(schools)
      .where(and(eq(schools.id, parsed.data.schoolId), eq(schools.organizationId, user.organizationId))).limit(1);
    if (!school) return { ok: false, message: "Établissement invalide." };

    const rate = parsed.data.preparedMeals ? parsed.data.wasteKg / (parsed.data.preparedMeals * 0.38) : 0;
    await db.insert(wasteRecords).values({
      id: uid("was"), organizationId: user.organizationId, schoolId: school.id, date: parsed.data.date,
      covers: parsed.data.covers, preparedMeals: parsed.data.preparedMeals, wasteKg: parsed.data.wasteKg,
      wasteCost: Math.round(parsed.data.wasteKg * 4.2 * 100) / 100,
      menuLabel: parsed.data.menuLabel ?? "Menu du jour", note: parsed.data.note ?? "", createdBy: user.id,
    });
    const org = await db.select({ threshold: organizations.alertThresholdWaste })
      .from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
    if (org[0] && rate > org[0].threshold) {
      await db.insert(alerts).values({
        id: uid("alert"), organizationId: user.organizationId, severity: "WARNING", category: "RESTAURATION",
        title: "Taux de pertes au-dessus du seuil",
        message: `${school.name} : ${Math.round(rate * 100)} % de pertes mesurés (seuil ${Math.round(org[0].threshold * 100)} %).`,
        link: "/predictions#pertes",
      });
    }
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "WASTE_RECORDED", entityType: "waste_record", entityId: school.id,
      humanDecision: parsed.data, detail: `Relevé de pertes ${parsed.data.date}`,
    });
    revalidatePath("/predictions");
    revalidatePath("/dashboard");
    return { ok: true, message: "Relevé de pertes enregistré." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function markAlertReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const alertId = String(formData.get("alertId") ?? "");
  await db.update(alerts).set({ isRead: true })
    .where(and(eq(alerts.id, alertId), eq(alerts.organizationId, session.user.organizationId)));
  revalidatePath("/dashboard");
}

