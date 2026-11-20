/**
 * Moteur de prévision 100 % TypeScript, entraîné à la demande sur l'historique SQLite.
 * - moyenne mobile 7 jours (décomposition saisonnière)
 * - facteur jour de semaine
 * - régression linéaire locale (tendance)
 * - événements du calendrier martiniquais (Carnaval, congés)
 * - chaleur estimée (saisonnalité tropicale)
 * Aucun appel réseau, aucun modèle externe.
 */
import { linearRegression, mean, standardDeviation } from "simple-statistics";
import { estimatedHeat, martiniqueEvents } from "@/lib/ml/calendar";
import { clamp, uid } from "@/lib/utils";

export type AttendancePoint = {
  date: string;
  expected: number;
  covers: number;
};

export type PredictionFeature = { label: string; impact: number };

export type TrainingResult = {
  version: string;
  trainedAtDays: number;
  averageCovers: number;
  weekdayFactors: number[]; // index 1 = lundi ... 0 = dimanche
  trendSlope: number;
  residualStd: number;
  baseWasteRate: number;
};

function dow(dateISO: string) {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

export function trainModel(history: AttendancePoint[], wasteRate = 0.11): TrainingResult {
  const points = [...history].filter((p) => p.covers > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 7) {
    return {
      version: "edupilot-ts-v1-coldstart",
      trainedAtDays: points.length,
      averageCovers: points.at(-1)?.covers ?? 60,
      weekdayFactors: [0.55, 1.06, 1.04, 1.03, 1.02, 0.98, 0.42],
      trendSlope: 0,
      residualStd: 8,
      baseWasteRate: wasteRate,
    };
  }

  // Décomposition : moyenne mobile glissante 7 jours puis ratio par jour de semaine.
  const smooth = points.map((_, i) => {
    const window = points.slice(Math.max(0, i - 3), i + 4);
    return mean(window.map((p) => p.covers));
  });
  const weekdayRaw = Array.from({ length: 7 }, () => [] as number[]);
  points.forEach((p, i) => {
    if (smooth[i] > 0) weekdayRaw[dow(p.date)].push(p.covers / smooth[i]);
  });
  const weekdayFactors = weekdayRaw.map((values) => {
    if (!values.length) return 1;
    const avg = mean(values);
    // Lissage bayésien vers 1 pour les petits échantillons.
    return clamp((avg * values.length + 1 * 4) / (values.length + 4), 0.25, 1.35);
  });

  // Tendance locale : régression sur les 28 derniers jours normalisés.
  const recent = points.slice(-28);
  const regression = linearRegression(
    recent.map((p, i) => [i, p.covers / (weekdayFactors[dow(p.date)] || 1)]),
  );
  const trendSlope = regression.m;

  const residuals = points.slice(-28).map((p, i) => {
    const idx = points.length - Math.min(28, points.length) + i;
    const expected = (smooth[idx] ?? p.covers) * (weekdayFactors[dow(p.date)] ?? 1);
    return p.covers - expected;
  });
  const residualStd = Math.max(2.5, standardDeviation(residuals));

  return {
    version: "edupilot-ts-v1",
    trainedAtDays: points.length,
    averageCovers: mean(points.slice(-28).map((p) => p.covers)),
    weekdayFactors,
    trendSlope,
    residualStd,
    baseWasteRate: wasteRate,
  };
}

export type CoverForecast = {
  date: string;
  covers: number;
  lower: number;
  upper: number;
  confidence: number;
  recommendedMeals: number;
  expectedWasteKg: number;
  features: PredictionFeature[];
};

/** Prévision pour une série de jours calendaires consécutifs. */
export function forecast(
  history: AttendancePoint[],
  model: TrainingResult,
  startDate: string,
  days: number,
  options: { expected: number; extraHolidays?: string[]; wasteRate?: number } ,
): CoverForecast[] {
  const events = martiniqueEvents(
    Number(startDate.slice(0, 4)) - 1,
    Number(startDate.slice(0, 4)) + 1,
  );
  const last = [...history].filter((p) => p.covers > 0).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const daysSinceLast = last ? Math.max(1, Math.round((new Date(`${startDate}T12:00:00Z`).getTime() - new Date(`${last.date}T12:00:00Z`).getTime()) / 86_400_000)) : 1;
  const wasteRate = options.wasteRate ?? model.baseWasteRate;

  return Array.from({ length: days }, (_, h) => {
    const date = new Date(`${startDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + h);
    const dateISO = date.toISOString().slice(0, 10);
    const day = dow(dateISO);
    const weekday = model.weekdayFactors[day] ?? 1;
    const trend = 1 + (model.trendSlope * (daysSinceLast + h)) / Math.max(1, model.averageCovers);
    const event = events.find((e) => e.date === dateISO);
    const extraHoliday = options.extraHolidays?.includes(dateISO);
    let eventFactor = 1;
    let eventLabel = "";
    if (event?.kind === "HOLIDAY" || extraHoliday) {
      eventFactor = 0.32;
      eventLabel = event?.label ?? "Jour férié paramétré";
    } else if (event?.kind === "CARNIVAL") {
      eventFactor = 0.58;
      eventLabel = event.label;
    } else if (event?.kind === "VACATION") {
      eventFactor = 0.62;
      eventLabel = event.label;
    }
    const heat = estimatedHeat(dateISO);
    const heatFactor = heat >= 32 ? 0.93 : heat <= 25 ? 1.02 : 1;
    const base = model.averageCovers * weekday * clamp(trend, 0.7, 1.3) * eventFactor * heatFactor;
    const covers = Math.round(clamp(base, 0, options.expected));

    const horizonUncertainty = 1 + h * 0.14;
    const spread = Math.max(3, Math.round(model.residualStd * horizonUncertainty * 1.28));
    const confidence = clamp(0.96 - h * 0.021 - (model.residualStd / Math.max(1, model.averageCovers)) * 0.6, 0.6, 0.97);
    const recommendedMeals = Math.round(covers * (1 + wasteRate * 0.35) + 2);
    const expectedWasteKg = Math.round(recommendedMeals * wasteRate * 0.38 * 10) / 10;

    const features: PredictionFeature[] = [
      { label: "Moyenne mobile 7 j", impact: Math.round((model.averageCovers / Math.max(1, options.expected)) * 100) },
      { label: `Effet ${["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][day]}`, impact: Math.round((weekday - 1) * 100) },
      { label: "Tendance 28 j (régression)", impact: Math.round((clamp(trend, 0.7, 1.3) - 1) * 100) },
      { label: eventLabel || "Calendrier scolaire", impact: Math.round((eventFactor - 1) * 100) },
      { label: `Température estimée ${heat.toFixed(1)} °C`, impact: Math.round((heatFactor - 1) * 100) },
      { label: "Taux de perte historique", impact: Math.round(wasteRate * -100) },
    ];

    return {
      date: dateISO,
      covers,
      lower: Math.max(0, covers - spread),
      upper: Math.min(options.expected, covers + spread),
      confidence: Math.round(confidence * 100) / 100,
      recommendedMeals,
      expectedWasteKg,
      features,
    };
  });
}

export type Accuracy = {
  count: number;
  mae: number;
  mape: number;
  withinInterval: number;
  series: Array<{ date: string; predicted: number; actual: number }>;
};

/** Exactitude mesurée a posteriori (prévisions validées vs présences réelles). */
export function computeAccuracy(
  predictions: Array<{ date: string; predictedCovers: number; lowerBound: number; upperBound: number }>,
  actual: AttendancePoint[],
): Accuracy {
  const actualByDate = new Map(actual.map((a) => [a.date, a.covers]));
  const series = predictions
    .map((p) => ({ date: p.date, predicted: p.predictedCovers, actual: actualByDate.get(p.date) }))
    .filter((p): p is { date: string; predicted: number; actual: number } => p.actual !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!series.length) return { count: 0, mae: 0, mape: 0, withinInterval: 0, series: [] };
  const errors = series.map((s) => Math.abs(s.predicted - s.actual));
  const mapeValues = series.map((s) => Math.abs(s.predicted - s.actual) / Math.max(1, s.actual));
  const inInterval = predictions.filter((p) => {
    const a = actualByDate.get(p.date);
    return a !== undefined && a >= p.lowerBound && a <= p.upperBound;
  }).length;
  return {
    count: series.length,
    mae: Math.round(mean(errors) * 10) / 10,
    mape: Math.round(mean(mapeValues) * 1000) / 10,
    withinInterval: Math.round((inInterval / series.length) * 100),
    series,
  };
}

export function newPredictionId() {
  return uid("pred");
}
