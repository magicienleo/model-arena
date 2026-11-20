import { db } from "@/db";
import { organizations } from "@/db/schema";

let bootstrapPromise: Promise<void> | null = null;

/** Amorçage automatique : au premier accès, la base locale est créée et remplie. */
export function ensureSeeded() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const existing = db.select({ id: organizations.id }).from(organizations).limit(1).all();
        if (existing.length) return;
        // Import différé pour éviter tout cycle module base <-> seed.
        const { seedDatabase } = await import("../../scripts/seed-data");
        seedDatabase();
      } catch (error) {
        bootstrapPromise = null;
        console.error("[ÉduPilot] Impossible d'amorcer la base SQLite :", error);
      }
    })();
  }
  return bootstrapPromise;
}
