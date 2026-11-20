/**
 * Scoring social déterministe : règles publiques + petit modèle linéaire local.
 * Le score ne DÉCIDE jamais : il produit une suggestion soumise à validation humaine.
 */
import { clamp, uid } from "@/lib/utils";

export type Bareme = { base: number; partQ1: number; partQ2: number; partQ3: number; max: number };

export type AidScoreInput = {
  quotientFamilial: number;
  childrenCount: number;
  documentsComplete: boolean;
  singleParent: boolean;
  urgencyDays: number;
  amountAsked: number;
  bareme: Bareme;
};

export type AidScoreResult = {
  score: number;
  suggestedAmount: number;
  explanation: Array<{ label: string; points: number }>;
  reason: string;
};

export function scoreAid(input: AidScoreInput): AidScoreResult {
  const qf = input.quotientFamilial;
  const explanation: Array<{ label: string; points: number }> = [];

  const qfPoints = qf <= 250 ? 30 : qf <= 400 ? 24 : qf <= 600 ? 18 : qf <= 900 ? 10 : 4;
  explanation.push({ label: `Quotient familial (${qf})`, points: qfPoints });

  const sibPoints = clamp((input.childrenCount - 1) * 6, 0, 18);
  explanation.push({ label: `Nombre d'enfants à charge (${input.childrenCount})`, points: sibPoints });

  const docPoints = input.documentsComplete ? 14 : 0;
  explanation.push({ label: input.documentsComplete ? "Dossier complet" : "Pièces manquantes", points: docPoints });

  const parentPoints = input.singleParent ? 10 : 0;
  explanation.push({ label: input.singleParent ? "Parent isolé" : "Situation familiale ordinaire", points: parentPoints });

  const urgencyPoints = input.urgencyDays <= 7 ? 12 : input.urgencyDays <= 15 ? 8 : input.urgencyDays <= 30 ? 4 : 0;
  explanation.push({ label: `Délai avant échéance (${input.urgencyDays} j)`, points: urgencyPoints });

  const score = clamp(Math.round(explanation.reduce((sum, item) => sum + item.points, 0)), 0, 100);
  const parts =
    (qf <= 350 ? input.bareme.partQ1 : 0) +
    (input.childrenCount >= 2 ? input.bareme.partQ2 : 0) +
    (input.childrenCount >= 3 ? input.bareme.partQ3 : 0) +
    (input.singleParent ? 30 : 0);
  const suggestedAmount = Math.round(Math.min(input.amountAsked, input.bareme.base + parts, input.bareme.max));
  const reason = score >= 60 ? "Aide prioritaire" : score >= 40 ? "Aide éligible" : "Aide à étudier";

  return { score, suggestedAmount, explanation, reason };
}

/** Extraction OCR simulée : renvoie un payload normalisé, sans appel réseau. */
export function mockOcr(fileName: string) {
  return {
    engine: "ocr-local-stub-v1",
    fileName,
    confidence: 0.87,
    fields: {
      nom: "Extrait d'avis d'imposition — nom détecté",
      quotientFamilial: 412,
      annee: new Date().getFullYear() - 1,
      numeroFiscal: `${Math.floor(10 + Math.random() * 89)}${Math.floor(1000 + Math.random() * 8999)}`,
    },
    mention: "P1 · OCR avancé : stub (aucune donnée ne quitte l'instance)",
  };
}

export function newAidReference() {
  return `AID-${new Date().getFullYear()}-${uid("").slice(1, 7).toUpperCase()}`;
}
