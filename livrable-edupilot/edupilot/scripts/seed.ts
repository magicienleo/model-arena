import { seedDatabase } from "./seed-data";

const force = process.argv.includes("--force") || process.argv.includes("--reset");

try {
  const result = seedDatabase({ force });
  console.log("ÉduPilot — seed terminé");
  console.log(JSON.stringify(result, null, 2));
  if (!force && !result.seeded) console.log("Astuce : pnpm seed --force pour régénérer intégralement les données.");
} catch (error) {
  console.error("Échec du seed :", error);
  process.exit(1);
}
