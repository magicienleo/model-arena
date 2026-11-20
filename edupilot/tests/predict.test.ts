import { describe, expect, it } from "vitest";
import { computeAccuracy, forecast, trainModel, type AttendancePoint } from "@/lib/ml/predict";
import { estimatedHeat, martiniqueEvents } from "@/lib/ml/calendar";

function history(days = 90): AttendancePoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(2026, 7, 1));
    date.setUTCDate(date.getUTCDate() + i);
    const dow = date.getUTCDay();
    return {
      date: date.toISOString().slice(0, 10),
      expected: 120,
      covers: dow === 0 ? 8 : dow === 6 ? 45 : 90 + (i % 5),
    };
  });
}

describe("moteur de prévision local", () => {
  it("entraîne un modèle sur 90 jours avec un effet week-end marqué", () => {
    const model = trainModel(history());
    expect(model.version).toBe("edupilot-ts-v1");
    expect(model.trainedAtDays).toBe(90);
    expect(model.weekdayFactors[0]).toBeLessThan(model.weekdayFactors[2]);
    expect(model.residualStd).toBeGreaterThan(0);
  });

  it("produit 7 prévisions bornées, avec confiance et explications", () => {
    const points = history();
    const model = trainModel(points);
    const result = forecast(points, model, "2026-10-30", 7, { expected: 120 });
    expect(result).toHaveLength(7);
    expect(result[0].date).toBe("2026-10-30");
    for (const day of result) {
      expect(day.covers).toBeGreaterThanOrEqual(0);
      expect(day.covers).toBeLessThanOrEqual(120);
      expect(day.lower).toBeLessThanOrEqual(day.covers);
      expect(day.upper).toBeGreaterThanOrEqual(day.covers);
      expect(day.confidence).toBeGreaterThanOrEqual(0.6);
      expect(day.confidence).toBeLessThanOrEqual(0.97);
      expect(day.features.length).toBeGreaterThanOrEqual(5);
      expect(day.recommendedMeals).toBeGreaterThan(0);
    }
    expect(result[0].confidence).toBeGreaterThan(result[6].confidence);
  });

  it("prend en compte le Carnaval et les jours fériés martiniquais", () => {
    const events = martiniqueEvents(2026, 2027);
    expect(events.some((e) => e.label.includes("Mardi Gras"))).toBe(true);
    expect(events.some((e) => e.label === "Abolition de l'esclavage")).toBe(true);
    const points = history();
    const model = trainModel(points);
    const carnaval = events.find((e) => e.label.includes("Mardi Gras"))!;
    const forecastDay = forecast(points, model, carnaval.date, 1, { expected: 120 })[0];
    const normal = forecast(points, model, "2026-10-06", 1, { expected: 120 })[0];
    expect(forecastDay.covers).toBeLessThan(normal.covers);
    expect(forecastDay.features.some((f) => f.label.includes("Mardi Gras"))).toBe(true);
    expect(estimatedHeat("2026-08-15")).toBeGreaterThan(estimatedHeat("2026-02-15"));
  });

  it("mesure l'exactitude contre les présences réelles", () => {
    const accuracy = computeAccuracy(
      [
        { date: "2026-10-01", predictedCovers: 90, lowerBound: 80, upperBound: 100 },
        { date: "2026-10-02", predictedCovers: 88, lowerBound: 78, upperBound: 98 },
      ],
      [
        { date: "2026-10-01", expected: 120, covers: 92 },
        { date: "2026-10-02", expected: 120, covers: 70 },
      ],
    );
    expect(accuracy.count).toBe(2);
    expect(accuracy.mae).toBe(10);
    expect(accuracy.withinInterval).toBe(50);
    expect(accuracy.series[0].actual).toBe(92);
  });
});
