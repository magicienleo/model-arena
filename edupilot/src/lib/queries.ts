import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  aidRequests, alerts, attendance, auditLogs, children, families, haccpChecks, organizations, predictions,
  predictionValidations, schools, wasteRecords, planningShifts, integrationEvents, users,
} from "@/db/schema";
import { isoDay, todayISO } from "@/lib/utils";
import { computeAccuracy } from "@/lib/ml/predict";

export async function getOrganizationById(id: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return org;
}

export async function getDashboardData(orgId: string) {
  const today = todayISO();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgSchools = await db.select().from(schools).where(eq(schools.organizationId, orgId));
  const schoolIds = orgSchools.map((s) => s.id);
  if (!schoolIds.length) return null;

  const last14 = await db.select().from(attendance)
    .where(and(eq(attendance.organizationId, orgId), gte(attendance.date, isoDay(-13))))
    .orderBy(asc(attendance.date));
  const nextPredictions = await db.select({
    pred: predictions,
    school: schools.name,
  }).from(predictions)
    .innerJoin(schools, eq(schools.id, predictions.schoolId))
    .where(and(eq(predictions.organizationId, orgId), gte(predictions.date, today)))
    .orderBy(asc(predictions.date), asc(schools.name)).limit(40);

  const wastes = await db.select().from(wasteRecords)
    .where(and(eq(wasteRecords.organizationId, orgId), gte(wasteRecords.date, isoDay(-13))))
    .orderBy(asc(wasteRecords.date));
  const aids = await db.select().from(aidRequests).where(eq(aidRequests.organizationId, orgId));
  const orgAlerts = await db.select().from(alerts)
    .where(and(eq(alerts.organizationId, orgId), eq(alerts.isRead, false)))
    .orderBy(desc(alerts.createdAt)).limit(8);
  const haccpRecent = await db.select().from(haccpChecks)
    .where(and(eq(haccpChecks.organizationId, orgId), eq(haccpChecks.conform, false)))
    .orderBy(desc(haccpChecks.date)).limit(5);

  const byDate = new Map<string, { expected: number; covers: number }>();
  for (const row of last14) {
    const acc = byDate.get(row.date) ?? { expected: 0, covers: 0 };
    acc.expected += row.expected;
    acc.covers += row.covers;
    byDate.set(row.date, acc);
  }
  const predictedByDate = new Map<string, number>();
  for (const { pred } of nextPredictions) {
    predictedByDate.set(pred.date, (predictedByDate.get(pred.date) ?? 0) + pred.predictedCovers);
  }
  const attendanceSeries = Array.from({ length: 14 }, (_, i) => {
    const date = isoDay(i - 13);
    const actual = byDate.get(date);
    return {
      date,
      label: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
      reel: actual?.covers ?? 0,
      attendu: actual?.expected ?? 0,
      prevu: predictedByDate.get(date) ?? null,
    };
  });
  const forecastSeries = Array.from({ length: 7 }, (_, i) => {
    const date = isoDay(i + 1);
    return {
      date,
      label: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
      prevu: predictedByDate.get(date) ?? 0,
    };
  });
  const wasteByDate = new Map<string, { prepared: number; waste: number; cost: number }>();
  for (const w of wastes) {
    const acc = wasteByDate.get(w.date) ?? { prepared: 0, waste: 0, cost: 0 };
    acc.prepared += w.preparedMeals;
    acc.waste += w.wasteKg;
    acc.cost += w.wasteCost;
    wasteByDate.set(w.date, acc);
  }
  const wasteSeries = Array.from({ length: 10 }, (_, i) => {
    const date = isoDay(-9 + i);
    const v = wasteByDate.get(date);
    return { date, label: date.slice(8), percent: v && v.prepared ? Math.round((v.waste / (v.prepared * 0.38)) * 1000) / 10 : 0, cost: v?.cost ?? 0 };
  });
  const averageWaste = wasteSeries.length
    ? wasteSeries.reduce((s, w) => s + w.percent, 0) / Math.max(1, wasteSeries.filter((w) => w.percent > 0).length)
    : 0;

  // Consommation budgétaire estimée du mois (repas servis × coût moyen).
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthAttendance = await db.select({ covers: attendance.covers }).from(attendance)
    .where(and(eq(attendance.organizationId, orgId), gte(attendance.date, monthStart), lte(attendance.date, today)));
  const spent = monthAttendance.reduce((sum, a) => sum + a.covers * 3.25, 0);
  const budget = org?.budget ?? 1;
  const budgetSeries = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 6 + i, 1));
    const key = month.toISOString().slice(0, 7);
    const base = budget / 12;
    return {
      month: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(month),
      consomme: Math.round(base * (0.82 + ((i * 7) % 9) / 40)),
      prevu: Math.round(base),
      key,
    };
  });
  budgetSeries[budgetSeries.length - 1].consomme = Math.round(spent);

  const openAids = aids.filter((a) => a.status === "DEPOSITED" || a.status === "SCORED").length;
  const validatedAids = aids.filter((a) => a.status === "VALIDATED");
  const aidDelay = validatedAids.length
    ? Math.round(validatedAids.reduce((sum, a) => sum + (a.decidedAt?.getTime() ?? a.depositedAt.getTime()) - a.depositedAt.getTime(), 0) / validatedAids.length / 86_400_000 * 10) / 10
    : 0;

  const allPredHistory = await db.select({
    date: predictions.date,
    predictedCovers: predictions.predictedCovers,
    lowerBound: predictions.lowerBound,
    upperBound: predictions.upperBound,
  }).from(predictions).where(eq(predictions.organizationId, orgId));
  const accuracy = computeAccuracy(allPredHistory, last14);

  const todayCovers = Array.from(byDate.values()).at(-1)?.covers ?? 0;
  const todayPredictions = nextPredictions.filter((p) => p.pred.date === today);
  const predictedToday = todayPredictions.reduce((s, p) => s + p.pred.predictedCovers, 0);

  return {
    org,
    schools: orgSchools.length,
    children: (await db.select({ id: children.id }).from(children).where(eq(children.organizationId, orgId))).length,
    kpis: {
      predictedToday,
      actualToday: todayCovers,
      attendanceDelta: predictedToday ? Math.round(((todayCovers - predictedToday) / predictedToday) * 1000) / 10 : 0,
      wastePercent: Math.round(averageWaste * 10) / 10,
      wasteCost: wasteSeries.reduce((s, w) => s + w.cost, 0),
      budgetSpent: Math.round(spent),
      budget,
      budgetPercent: Math.round((spent / budget) * 1000) / 10,
      openAids,
      totalAids: aids.length,
      aidAmount: validatedAids.reduce((s, a) => s + (a.finalAmount ?? 0), 0),
      aidDelay,
      alerts: orgAlerts.length,
      accuracy: accuracy.count ? accuracy : null,
      haccpIssues: haccpRecent.length,
    },
    attendanceSeries,
    forecastSeries,
    wasteSeries,
    budgetSeries,
    haccpRecent,
    alerts: orgAlerts,
    predictions: nextPredictions.slice(0, 12),
    schoolCount: schoolIds.length,
  };
}

export async function getPredictionPageData(orgId: string) {
  const today = todayISO();
  const rows = await db.select({ pred: predictions, school: schools.name })
    .from(predictions)
    .innerJoin(schools, eq(schools.id, predictions.schoolId))
    .where(and(eq(predictions.organizationId, orgId), gte(predictions.date, isoDay(-3))))
    .orderBy(asc(predictions.date), asc(schools.name));
  const history = await db.select().from(attendance)
    .where(and(eq(attendance.organizationId, orgId), gte(attendance.date, isoDay(-89))));
  const pastPredictions = await db.select().from(predictions)
    .where(and(eq(predictions.organizationId, orgId), lte(predictions.date, today)));
  const accuracy = computeAccuracy(pastPredictions, history);
  const validations = await db.select({
    validation: predictionValidations, prediction: predictions, school: schools.name, validator: users.name,
  }).from(predictionValidations)
    .innerJoin(predictions, eq(predictions.id, predictionValidations.predictionId))
    .innerJoin(schools, eq(schools.id, predictions.schoolId))
    .innerJoin(users, eq(users.id, predictionValidations.validatorId))
    .where(eq(predictionValidations.organizationId, orgId))
    .orderBy(desc(predictionValidations.decidedAt)).limit(12);
  const wasteLast = await db.select().from(wasteRecords)
    .where(eq(wasteRecords.organizationId, orgId)).orderBy(desc(wasteRecords.date)).limit(20);
  return { rows, accuracy, validations, wasteLast, today };
}

export async function getAidPageData(orgId: string) {
  const rows = await db.select({ aid: aidRequests, family: families })
    .from(aidRequests)
    .leftJoin(families, eq(families.id, aidRequests.familyId))
    .where(eq(aidRequests.organizationId, orgId))
    .orderBy(desc(aidRequests.depositedAt)).limit(120);
  return rows;
}

export async function getAdminData(orgId: string) {
  const orgUsers = await db.select().from(users).where(eq(users.organizationId, orgId)).orderBy(asc(users.name));
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, orgId)).orderBy(desc(auditLogs.createdAt)).limit(150);
  const events = await db.select().from(integrationEvents).where(eq(integrationEvents.organizationId, orgId)).orderBy(desc(integrationEvents.receivedAt)).limit(12);
  const shifts = await db.select().from(planningShifts).where(eq(planningShifts.organizationId, orgId)).limit(1);
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return { orgUsers, logs, events, org, hasPlanning: shifts.length > 0 };
}
