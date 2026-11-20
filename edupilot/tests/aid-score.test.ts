import { describe, expect, it } from "vitest";
import { mockOcr, scoreAid } from "@/lib/ml/aid-score";

const bareme = { base: 120, partQ1: 65, partQ2: 45, partQ3: 25, max: 380 };
const input = {
  quotientFamilial: 300, childrenCount: 2, documentsComplete: true,
  singleParent: false, urgencyDays: 5, amountAsked: 300, bareme,
};

describe("scoring des aides sociales", () => {
  it("donne un score plus élevé aux quotients familiaux faibles", () => {
    const low = scoreAid({ ...input, quotientFamilial: 200 });
    const high = scoreAid({ ...input, quotientFamilial: 1200 });
    expect(low.score).toBeGreaterThan(high.score);
    expect(low.reason).not.toBe(high.reason);
  });

  it("pénalise les pièces manquantes et plafonne le montant", () => {
    const complete = scoreAid(input);
    const incomplete = scoreAid({ ...input, documentsComplete: false });
    expect(incomplete.score).toBeLessThan(complete.score);
    const capped = scoreAid({ ...input, amountAsked: 1000, childrenCount: 6 });
    expect(capped.suggestedAmount).toBeLessThanOrEqual(bareme.max);
  });

  it("fournit une explication dont les points somment au score", () => {
    const result = scoreAid(input);
    const sum = result.explanation.reduce((total, item) => total + item.points, 0);
    expect(result.score).toBe(sum);
    expect(result.explanation.length).toBe(5);
  });

  it("simule un OCR local sans service externe", () => {
    const ocr = mockOcr("avis.pdf");
    expect(ocr.engine).toContain("stub");
    expect(ocr.fields.annee).toBeLessThanOrEqual(new Date().getFullYear());
  });
});
