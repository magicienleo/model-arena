import { expect, test } from "@playwright/test";

const DIRECTEUR = {
  email: "directeur@fdf.edupilot.local",
  password: "edupilot",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail professionnelle").fill(DIRECTEUR.email);
  await page.getByLabel("Mot de passe").fill(DIRECTEUR.password);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("un directeur voit les KPI et les graphiques du tableau de bord", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: /Bonjour|Bon après-midi|Bonsoir/ })).toBeVisible();
  await expect(page.getByText("Couverts prévus aujourd'hui")).toBeVisible();
  await expect(page.getByText("Centre d'alertes")).toBeVisible();
  await expect(page.getByText("Prévisions à confirmer")).toBeVisible();
});

test("la validation IA conserve la suggestion et la décision humaine", async ({ page }) => {
  await login(page);
  await page.goto("/predictions");
  await expect(page.getByText("Suggestion IA — validation humaine obligatoire.")).toBeVisible();
  const firstPrediction = page.getByRole("link", { name: /Adjust & Valider/ }).first();
  await firstPrediction.click();
  await expect(page.getByText("Suggestion du modèle")).toBeVisible();
  await expect(page.getByRole("button", { name: /Valider la décision/ })).toBeVisible();
  const input = page.getByLabel("Couverts retenus (humain)");
  await input.fill("95");
  await expect(page.getByText(/Écart avec la proposition IA/)).toBeVisible();
  await page.getByLabel("Motif de l'ajustement").fill("Groupe confirmé par l'école");
  await page.getByRole("button", { name: /Valider la décision/ }).click();
  await expect(page.getByText(/Décision enregistrée et auditée/)).toBeVisible({ timeout: 15_000 });
});
