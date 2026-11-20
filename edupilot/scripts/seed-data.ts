/**
 * Jeu de données réaliste et déterministe : 2 caisses, 230+ enfants,
 * 90 jours d'historique, prévisions, aides, HACCP, planning, interop, audit.
 * Tout est généré localement dans data/edupilot.db.
 */
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { db, initDb } from "../src/db";
import * as s from "../src/db/schema";
import { addDays, isoDay, num, uid } from "../src/lib/utils";
import { estimatedHeat, martiniqueEvents } from "../src/lib/ml/calendar";
import { forecast, trainModel, type AttendancePoint } from "../src/lib/ml/predict";
import { newAidReference, scoreAid } from "../src/lib/ml/aid-score";
import type { Role } from "../src/lib/permissions";

const PASSWORD = process.env.SEED_PASSWORD ?? "edupilot";

const firstNames = ["Léa", "Nathan", "Maëlys", "Yanis", "Camille", "Jules", "Manon", "Enzo", "Sarah", "Lucas", "Inès", "Raphaël", "Zoé", "Malo", "Emma", "Téo", "Awa", "Noah", "Jade", "Ilan", "Clara", "Sohan", "Lina", "Kylian", "Eva", "Timéo", "Nina", "Elias"];
const lastNames = ["Bernard", "Joseph", "Pierre-Louis", "Marcelin", "Alexandre", "Constance", "Désir", "Sophie", "Alphonse", "Nicolle", "Roger", "Édouard", "Léger", "Marin", "Bonnaire", "Ferdinand", "Castel", "Lobin", "Rivière", "Achille", "Théodore", "Bérard", "Céran", "Dupont", "Etienne", "Giraud", "Hippolyte", "Iry"];
const streets = ["Rue de la République", "Avenue des Caraïbes", "Quartier Saint-James", "Rue Pasteur", "Route du Lamentin", "Rue Jean Jaurès", "Rue du Gouverneur", "Place de la Savane", "Rue des Colibris", "Chemin de la Battery"];
const citiesFdF = ["Fort-de-France", "Le Carbet", "Saint-Joseph", "Schœlcher"];
const citiesL = ["Le Lamentin", "Le Lamentin", "Saint-Esprit", "Petit-Bourg"];
const menus = [
  { label: "Riz aux haricots rouges, poulet collinearis", products: ["riz", "haricots rouges", "poulet local", "tomate"] },
  { label: "Accras de morue, bananes plantains, salade", products: ["morue", "banane plantain", "chou"] },
  { label: "Blaff de poisson, igname, légumes pays", products: ["poisson", "igname", "carotte", "manioc"] },
  { label: "Colombo de cabri, riz créole, mangue", products: ["cabri", "riz", "mangue"] },
  { label: "Poulet grillé, gratin de macaté, salade verte", products: ["poulet", "macaté", "laitue"] },
  { label: "Soupe de poisson aux légumes, croûtes de pain", products: ["poisson", "courge", "pain"] },
  { label: "Riz au lait de coco, poulet, haricots verts", products: ["lait de coco", "riz", "poulet", "haricots verts"] },
];

function rand(seed: number) {
  let x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function chunk<T>(items: T[], size = 180): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function insertAll<T extends object>(table: Parameters<typeof db.insert>[0], rows: T[]) {
  for (const group of chunk(rows)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.insert(table as never).values(group as never).run();
  }
}

function clearAll() {
  const tables = [
    s.aidDocuments, s.aidValidations, s.haccpPhotos, s.timeClocks, s.predictionValidations,
    s.integrationEvents, s.auditLogs, s.alerts, s.planningShifts, s.haccpChecks, s.aidRequests,
    s.wasteRecords, s.predictions, s.menus, s.attendance, s.children, s.families, s.staff,
    s.schools, s.sessions, s.accounts, s.verificationTokens, s.users, s.organizations,
  ];
  for (const table of tables) db.delete(table).run();
}

export function seedDatabase(options: { force?: boolean } = {}) {
  initDb();
  const existing = db.select({ id: s.organizations.id }).from(s.organizations).all();
  if (existing.length && !options.force) return { seeded: false, reason: "données déjà présentes" };
  clearAll();

  const passwordHash = bcrypt.hashSync(PASSWORD, 10);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // --- Organisations ---------------------------------------------------
  insertAll(s.organizations, [
    {
      id: "org-fdf", name: "Caisse des Écoles de Fort-de-France", shortName: "FdF", city: "Fort-de-France",
      siret: "180 470 019 00019", sourceSystem: "portail-familles-fdf", budget: 2_480_000,
      alertThresholdWaste: 0.12, alertThresholdOccupancy: 0.72,
      aidBareme: { base: 120, partQ1: 65, partQ2: 45, partQ3: 25, max: 380 },
      calendar: [isoDay(14), isoDay(21)],
    },
    {
      id: "org-lamentin", name: "Caisse des Écoles du Lamentin", shortName: "Lamentin", city: "Le Lamentin",
      siret: "180 470 025 00025", sourceSystem: "espace-citoyens-lamentin", budget: 1_610_000,
      alertThresholdWaste: 0.13, alertThresholdOccupancy: 0.70,
      aidBareme: { base: 110, partQ1: 60, partQ2: 40, partQ3: 25, max: 350 },
      calendar: [isoDay(9)],
    },
  ]);

  // --- Utilisateurs ----------------------------------------------------
  const users: Array<{ name: string; email: string; role: Role; organizationId: string }> = [
    { name: "Marie-Claire Desbonnes", email: "directeur@fdf.edupilot.local", role: "DIRECTOR", organizationId: "org-fdf" },
    { name: "Jean-Philippe Marlin", email: "restauration@fdf.edupilot.local", role: "RESTAURATION_MANAGER", organizationId: "org-fdf" },
    { name: "Sonia Béatrice", email: "aides@fdf.edupilot.local", role: "AID_AGENT", organizationId: "org-fdf" },
    { name: "Étienne Castel", email: "finance@fdf.edupilot.local", role: "FINANCE", organizationId: "org-fdf" },
    { name: "Corinne Alford", email: "cuisine@fdf.edupilot.local", role: "STAFF", organizationId: "org-fdf" },
    { name: "Admin ÉduPilot", email: "admin@fdf.edupilot.local", role: "ADMIN", organizationId: "org-fdf" },
    { name: "Patrick Saint-Louis", email: "directeur@lamentin.edupilot.local", role: "DIRECTOR", organizationId: "org-lamentin" },
    { name: "Aline Régis", email: "restauration@lamentin.edupilot.local", role: "RESTAURATION_MANAGER", organizationId: "org-lamentin" },
    { name: "Nadège Pombo", email: "aides@lamentin.edupilot.local", role: "AID_AGENT", organizationId: "org-lamentin" },
    { name: "Georges Naraye", email: "finance@lamentin.edupilot.local", role: "FINANCE", organizationId: "org-lamentin" },
    { name: "Lucie Bernier", email: "cuisine@lamentin.edupilot.local", role: "STAFF", organizationId: "org-lamentin" },
    { name: "Admin Lamentin", email: "admin@lamentin.edupilot.local", role: "ADMIN", organizationId: "org-lamentin" },
  ];
  insertAll(s.users, users.map((u) => ({ ...u, id: uid("usr"), passwordHash, emailVerified: now, active: true })));
  const userByEmail = new Map(db.select().from(s.users).all().map((u) => [u.email, u]));
  const director = userByEmail.get("directeur@fdf.edupilot.local")!;

  // --- Écoles ----------------------------------------------------------
  const schoolDefs = [
    ["org-fdf", "École Victor Schœlcher", "Fort-de-France", "Centre", 148],
    ["org-fdf", "École Paul Gauguin", "Fort-de-France", "Sainte-Thérèse", 122],
    ["org-fdf", "École Frantz Fanon", "Fort-de-France", "Bellevue", 134],
    ["org-fdf", "École José-Maria de Heredia", "Fort-de-France", "Didier", 96],
    ["org-fdf", "École des Trois-Ilets", "Les Trois-Ilets", "Trois-Ilets", 84],
    ["org-fdf", "École de Saint-Joseph", "Saint-Joseph", "Saint-Joseph", 78],
    ["org-lamentin", "École du Bourg", "Le Lamentin", "Centre", 156],
    ["org-lamentin", "École de Petit-Bourg", "Petit-Bourg", "Petit-Bourg", 92],
    ["org-lamentin", "École de Saint-Esprit", "Saint-Esprit", "Saint-Esprit", 88],
    ["org-lamentin", "École La            Immaculée", "Le Lamentin", "Cottrell", 110],
  ] as const;
  insertAll(s.schools, schoolDefs.map(([org, name, city, district, capacity], i) => ({
    id: `eco-${String(i + 1).padStart(2, "0")}`, organizationId: org, name: name.replace(/\s+/g, " "), city, district,
    capacity, directorName: lastNames[(i * 3) % lastNames.length],
  })));
  const schools = db.select().from(s.schools).orderBy(asc(s.schools.id)).all();

  // --- Familles et enfants ---------------------------------------------
  const families: Array<typeof s.families.$inferInsert> = [];
  const children: Array<typeof s.children.$inferInsert> = [];
  for (let i = 0; i < 240; i++) {
    const org = i < 136 ? "org-fdf" : "org-lamentin";
    const orgSchools = schools.filter((sc) => sc.organizationId === org);
    const familyId = `fam-${String(i + 1).padStart(3, "0")}`;
    const ln = lastNames[i % lastNames.length];
    const fn = firstNames[(i * 7) % firstNames.length];
    const qf = 180 + Math.floor(rand(i + 3) * 1500);
    families.push({
      id: familyId, organizationId: org, externalId: `EXT-${org.slice(4, 6).toUpperCase()}-${1000 + i}`,
      source: org === "org-fdf" ? "portail-familles-fdf" : "espace-citoyens-lamentin",
      firstName: fn, lastName: ln, email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, "")}@exemple.mq`,
      phone: `0${696 + (i % 4)} ${String(10 + (i * 7) % 89)} ${String(10 + (i * 13) % 89)} ${String(10 + (i * 17) % 89)}`,
      address: `${10 + (i % 90)} ${streets[i % streets.length]}`,
      quotientFamilial: qf,
    });
    const kidCount = i % 5 === 0 ? 2 : 1;
    for (let k = 0; k < kidCount; k++) {
      const school = orgSchools[(i + k) % orgSchools.length];
      children.push({
        id: `enf-${String(children.length + 1).padStart(3, "0")}`, organizationId: org, familyId,
        schoolId: school.id, externalId: `ENF-${10000 + i * 2 + k}`,
        firstName: firstNames[(i * 7 + k * 11 + 3) % firstNames.length], lastName: ln,
        birthDate: `${2016 + ((i + k) % 7)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`,
        className: `${["CP", "CE1", "CE2", "CM1", "CM2"][(i + k) % 5]} ${["A", "B", "C"][i % 3]}`,
        allergenNote: i % 23 === 0 ? "Allergie aux arachides — repas adapté" : null,
      });
    }
  }
  insertAll(s.families, families);
  insertAll(s.children, children);
  const childrenBySchool = new Map<string, typeof children>();
  for (const c of children) {
    const list = childrenBySchool.get(c.schoolId) ?? [];
    list.push(c);
    childrenBySchool.set(c.schoolId, list);
  }

  // --- Historique de fréquentation (90 jours) --------------------------
  const events = martiniqueEvents(new Date().getFullYear() - 1, new Date().getFullYear() + 1);
  const historyBySchool = new Map<string, AttendancePoint[]>();
  const attendanceRows: Array<typeof s.attendance.$inferInsert> = [];
  const wasteRows: Array<typeof s.wasteRecords.$inferInsert> = [];
  const menuRows: Array<typeof s.menus.$inferInsert> = [];
  for (let schoolIndex = 0; schoolIndex < schools.length; schoolIndex++) {
    const school = schools[schoolIndex];
    const enrolled = childrenBySchool.get(school.id)?.length || Math.round(school.capacity * 0.8);
    const expected = Math.max(40, Math.min(school.capacity, Math.round(enrolled * 1.12)));
    const points: AttendancePoint[] = [];
    for (let d = -90; d <= 0; d++) {
      const date = isoDay(d);
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
      const event = events.find((e) => e.date === date);
      const factor = dow === 0 ? 0.35 : dow === 6 ? 0.62 : event?.kind === "HOLIDAY" ? 0.25 : event?.kind === "CARNIVAL" ? 0.5 : event?.kind === "VACATION" ? 0.6 : 1;
      const heat = estimatedHeat(date);
      const heatFactor = heat >= 32 ? 0.94 : 1;
      const wave = 1 + Math.sin((schoolIndex + d) / 11) * 0.035;
      const noise = 0.94 + rand(d * 31 + schoolIndex * 17) * 0.12;
      const covers = Math.max(0, Math.round(expected * 0.78 * factor * heatFactor * wave * noise));
      points.push({ date, expected, covers });
      attendanceRows.push({
        id: uid("att"), organizationId: school.organizationId, schoolId: school.id, date,
        expected, covers, source: "seed-historique",
      });
      if (d >= -45 && d <= -1 && dow !== 0) {
        const prepared = Math.round(covers * 1.08);
        const wasted = Math.round((prepared - covers) * (0.55 + rand(d + schoolIndex * 5) * 0.5) * 10) / 10;
        wasteRows.push({
          id: uid("was"), organizationId: school.organizationId, schoolId: school.id, date,
          covers, preparedMeals: prepared, wasteKg: wasted, wasteCost: Math.round(wasted * 4.2 * 100) / 100,
          menuLabel: menus[Math.abs(d) % menus.length].label, note: "",
        });
      }
      if (d >= -29 && d < 0) {
        menuRows.push({
          id: uid("menu"), organizationId: school.organizationId, date,
          label: menus[Math.abs(d) % menus.length].label, products: menus[Math.abs(d) % menus.length].products,
        });
      }
    }
    historyBySchool.set(school.id, points);
  }
  // Une seule ligne par école et par date pour les menus.
  const menusDedup = Array.from(new Map(menuRows.map((m) => [`${m.organizationId}|${m.date}`, m])).values());
  insertAll(s.attendance, attendanceRows);
  insertAll(s.wasteRecords, wasteRows);
  insertAll(s.menus, menusDedup);

  // --- Prévisions IA (7 jours) + validations humaines -------------------
  const predictionRows: Array<typeof s.predictions.$inferInsert> = [];
  const predictionValidations: Array<typeof s.predictionValidations.$inferInsert> = [];
  const auditRows: Array<typeof s.auditLogs.$inferInsert> = [];
  for (const school of schools) {
    const history = historyBySchool.get(school.id)!;
    const model = trainModel(history.map(({ date, expected, covers }) => ({ date, expected, covers })), 0.11);
    const lastExpected = history.at(-1)!.expected;
    const forecasts = forecast(history, lastExpected ? model : model, isoDay(1), 7, {
      expected: lastExpected,
      extraHolidays: school.organizationId === "org-fdf" ? [isoDay(14), isoDay(21)] : [isoDay(9)],
      wasteRate: 0.11,
    });
    forecasts.forEach((f, index) => {
      const id = uid("pred");
      const shouldValidate = index < 2 && schoolIndexUnderThree(school.id);
      predictionRows.push({
        id, organizationId: school.organizationId, schoolId: school.id, date: f.date,
        generatedAt: now, horizonDays: 7, predictedCovers: f.covers, lowerBound: f.lower,
        upperBound: f.upper, confidence: f.confidence, recommendedMeals: f.recommendedMeals,
        expectedWasteKg: f.expectedWasteKg, features: f.features, modelVersion: model.version,
        status: shouldValidate ? "VALIDATED" : "SUGGESTED",
      });
      if (shouldValidate) {
        const humanCovers = f.covers + (index % 2 === 0 ? 4 : -3);
        const humanMeals = f.recommendedMeals + (index % 2 === 0 ? 5 : -2);
        predictionValidations.push({
          id: uid("pval"), organizationId: school.organizationId, predictionId: id,
          validatorId: director.id, aiCovers: f.covers, humanCovers,
          aiMeals: f.recommendedMeals, humanMeals, deltaCovers: humanCovers - f.covers,
          reason: index === 0 ? "Réservation groupe scolaire confirmée par la direction" : "Ajustement météo",
          decidedAt: now,
        });
        auditRows.push({
          id: uid("log"), organizationId: school.organizationId, actorId: director.id,
          actorName: director.name, action: "PREDICTION_VALIDATED", entityType: "prediction", entityId: id,
          aiSuggestion: { covers: f.covers, meals: f.recommendedMeals, confidence: f.confidence },
          humanDecision: { covers: humanCovers, meals: humanMeals },
          detail: "Suggestion IA ajustée puis validée par un agent humain",
        });
      }
    });
  }
  function schoolIndexUnderThree(schoolId: string) {
    return schools.findIndex((sc) => sc.id === schoolId) < 3;
  }
  insertAll(s.predictions, predictionRows);
  insertAll(s.predictionValidations, predictionValidations);

  // Exactitude historique : on matérialise quelques prévisions passées consolidées.
  for (const school of schools.slice(0, 4)) {
    for (let d = -14; d <= -2; d += 3) {
      const actual = db.select().from(s.attendance).where(eq(s.attendance.date, isoDay(d))).all().find((a) => a.schoolId === school.id);
      if (!actual) continue;
      const estimate = Math.round(actual.covers * (0.94 + rand(d + 40) * 0.13));
      auditRows.push({
        id: uid("log"), organizationId: school.organizationId, actorId: director.id,
        actorName: director.name, action: "PREDICTION_GENERATED", entityType: "prediction", entityId: uid("pred-old"),
        aiSuggestion: { date: isoDay(d), covers: estimate }, humanDecision: null,
        detail: `Prévision historique — écart réel ${actual.covers - estimate} couverts`,
        createdAt: addDays(now, d),
      });
    }
  }

  // --- Aides sociales --------------------------------------------------
  const aidRows: Array<typeof s.aidRequests.$inferInsert> = [];
  const aidValidations: Array<typeof s.aidValidations.$inferInsert> = [];
  const aidDocumentRows: Array<typeof s.aidDocuments.$inferInsert> = [];
  const familyList = db.select().from(s.families).all();
  for (let i = 0; i < 34; i++) {
    const family = familyList[(i * 7) % familyList.length];
    const bareme = family.organizationId === "org-fdf"
      ? { base: 120, partQ1: 65, partQ2: 45, partQ3: 25, max: 380 }
      : { base: 110, partQ1: 60, partQ2: 40, partQ3: 25, max: 350 };
    const input = {
      quotientFamilial: family.quotientFamilial, childrenCount: family.id.endsWith("0") ? 3 : family.id.endsWith("5") ? 2 : 1,
      documentsComplete: i % 6 !== 0, singleParent: i % 7 === 0, urgencyDays: 3 + (i % 25),
      amountAsked: 120 + (i % 12) * 25, bareme,
    };
    const score = scoreAid(input);
    const status = i % 7 === 0 ? "DEPOSITED" : i % 7 === 1 ? "SCORED" : i % 3 === 0 ? "REJECTED" : "VALIDATED";
    const aidId = uid("aid");
    const validator = userByEmail.get(family.organizationId === "org-fdf" ? "aides@fdf.edupilot.local" : "aides@lamentin.edupilot.local")!;
    aidRows.push({
      id: aidId, organizationId: family.organizationId, familyId: family.id, reference: newAidReference(),
      applicantName: `${family.firstName} ${family.lastName}`, quotientFamilial: family.quotientFamilial,
      amountAsked: input.amountAsked, reason: ["Frais de cantine", "Sortie scolaire", "Fournitures", "Aide au transport"][i % 4],
      status, score: status === "DEPOSITED" ? null : score.score,
      suggestedAmount: status === "DEPOSITED" ? null : score.suggestedAmount,
      finalAmount: status === "VALIDATED" ? score.suggestedAmount : status === "REJECTED" ? 0 : null,
      scoreExplanation: status === "DEPOSITED" ? null : score.explanation,
      ocrPayload: i % 6 !== 0 ? { engine: "ocr-local-stub-v1", quotientFamilial: family.quotientFamilial, confidence: 0.87 } : null,
      source: family.source, depositedAt: addDays(now, -(i % 18)),
      decidedAt: status === "VALIDATED" || status === "REJECTED" ? addDays(now, -(i % 5)) : null,
    });
    if (status === "VALIDATED" || status === "REJECTED") {
      aidValidations.push({
        id: uid("aval"), organizationId: family.organizationId, aidRequestId: aidId, validatorId: validator.id,
        decision: status === "VALIDATED" ? "APPROVED" : "REJECTED",
        aiAmount: score.suggestedAmount, humanAmount: status === "VALIDATED" ? score.suggestedAmount : 0,
        reason: status === "VALIDATED" ? "Dossier conforme après contrôle humain" : "Revenus hors barème après étude du dossier",
        decidedAt: addDays(now, -(i % 5)),
      });
      auditRows.push({
        id: uid("log"), organizationId: family.organizationId, actorId: validator.id, actorName: validator.name,
        action: "AID_VALIDATED", entityType: "aid_request", entityId: aidId,
        aiSuggestion: { score: score.score, amount: score.suggestedAmount, reason: score.reason },
        humanDecision: { decision: status, amount: status === "VALIDATED" ? score.suggestedAmount : 0 },
        detail: "Validation humaine obligatoire appliquée",
      });
    }
    if (i % 6 !== 0) {
      aidDocumentRows.push({
        id: uid("doc"), organizationId: family.organizationId, aidRequestId: aidId,
        fileName: "avis-imposition.pdf", storedPath: "", mimeType: "application/pdf", size: 82_000,
        ocrText: `Quotient familial détecté : ${family.quotientFamilial}`,
      });
    }
  }
  insertAll(s.aidRequests, aidRows);
  insertAll(s.aidValidations, aidValidations);
  insertAll(s.aidDocuments, aidDocumentRows);

  // --- HACCP -----------------------------------------------------------
  const haccpRows: Array<typeof s.haccpChecks.$inferInsert> = [];
  const checkTypes = ["RECEPTION", "STOCKAGE", "CUISSE", "NETTOYAGE"];
  const staffByOrg = new Map<string, typeof s.users.$inferSelect[]>();
  const haccpStaff: Array<typeof s.staff.$inferInsert> = [];
  for (const org of ["org-fdf", "org-lamentin"]) {
    const staffNames = org === "org-fdf"
      ? [["Corinne", "Alford"], ["Maurice", "Léger"], ["Danièle", "Marcelin"], ["Régis", "Constance"]]
      : [["Lucie", "Bernier"], ["Serge", "Rivière"], ["Martine", "Achille"], ["Yoann", "Giraud"]];
    staffNames.forEach(([fn, ln], i) => {
      haccpStaff.push({
        id: uid("stf"), organizationId: org, firstName: fn, lastName: ln,
        position: ["Cuisinier", "Aide de cuisine", "Agent d'entretien", "Responsable cuisine"][i],
        schoolId: schools.filter((sc) => sc.organizationId === org)[i % 3]?.id ?? null,
      });
    });
  }
  insertAll(s.staff, haccpStaff);
  const allStaff = db.select().from(s.staff).all();
  for (const org of ["org-fdf", "org-lamentin"]) {
    const orgSchools = schools.filter((sc) => sc.organizationId === org);
    for (let d = -6; d <= 0; d++) {
      for (let i = 0; i < 4; i++) {
        const school = orgSchools[i % orgSchools.length];
        const type = checkTypes[i];
        const nonConform = (d + i) % 11 === 0;
        haccpRows.push({
          id: uid("hac"), organizationId: org, schoolId: school.id, date: isoDay(d), checkType: type,
          temperature: type === "RECEPTION" ? 3 + rand(d * 9 + i) * 5 : type === "CUISSE" ? 62 + rand(d * 3 + i) * 12 : null,
          productLabel: type === "RECEPTION" ? ["Poulet local", "Morue fraîche", "Légumes pays", "Riz"][i] : null,
          dlc: type === "STOCKAGE" ? isoDay(d + 4) : null,
          conform: !nonConform,
          note: nonConform ? "Température hors plage — action corrective engagée" : "Contrôle conforme",
          checkedBy: userByEmail.get(org === "org-fdf" ? "cuisine@fdf.edupilot.local" : "cuisine@lamentin.edupilot.local")?.id ?? null,
        });
      }
    }
  }
  insertAll(s.haccpChecks, haccpRows);

  // --- Planning & pointage ---------------------------------------------
  const shiftRows: Array<typeof s.planningShifts.$inferInsert> = [];
  for (const org of ["org-fdf", "org-lamentin"]) {
    const orgStaff = allStaff.filter((st) => st.organizationId === org);
    const orgSchools = schools.filter((sc) => sc.organizationId === org);
    for (let d = 1; d <= 7; d++) {
      const predicted = predictionRows.find((p) => p.organizationId === org && p.date === isoDay(d));
      orgStaff.forEach((st, i) => {
        if ((d + i) % 4 === 0) return;
        shiftRows.push({
          id: uid("shift"), organizationId: org, schoolId: orgSchools[i % orgSchools.length].id,
          staffId: st.id, date: isoDay(d), startHour: i % 2 === 0 ? "08:30" : "09:30",
          endHour: i % 2 === 0 ? "14:30" : "15:30",
          expectedCovers: predicted?.predictedCovers ?? 60, status: d === 1 && i < 2 ? "CLOCKED_IN" : "PLANNED",
        });
      });
    }
  }
  insertAll(s.planningShifts, shiftRows);
  const clockRows = db.select().from(s.planningShifts).all().filter((sh) => sh.status === "CLOCKED_IN").map((sh) => ({
    id: uid("clock"), organizationId: sh.organizationId, shiftId: sh.id,
    clockIn: new Date(`${sh.date}T08:32:00Z`), clockOut: null,
  }));
  insertAll(s.timeClocks, clockRows);

  // --- Alertes ---------------------------------------------------------
  const alertDefs = [
    ["CRITICAL", "HACCP", "Écart de température détecté", "Un contrôle de réception présente une température hors plage. Action corrective à tracer."],
    ["WARNING", "RESTAURATION", "Taux de pertes au-dessus du seuil", "Le taux de pertes moyen approche le seuil paramétré de la caisse."],
    ["INFO", "AIDES", "9 dossiers en attente de validation", "La validation humaine est obligatoire avant toute décision."],
    ["WARNING", "BUDGET", "Consommation budgétaire à 68 %", "Le rythme de consommation est supérieur à la tendance des trois dernières années."],
    ["INFO", "INTEROP", "Synchronisation Portail Familles terminée", "Les inscriptions et absences ont été normalisées dans la base locale."],
  ] as const;
  const alertRows: Array<typeof s.alerts.$inferInsert> = [];
  for (const org of ["org-fdf", "org-lamentin"]) {
    alertDefs.forEach(([severity, category, title, message], i) => alertRows.push({
      id: uid("alert"), organizationId: org, severity, category, title, message,
      link: ["/haccp", "/predictions", "/aides", "/dashboard", "/interop"][i],
      isRead: i === 4, createdAt: addDays(now, -i),
    }));
  }
  insertAll(s.alerts, alertRows);

  // --- Interopérabilité (payloads bruts + normalisés) -------------------
  const integrationRows: Array<typeof s.integrationEvents.$inferInsert> = [];
  for (const org of ["org-fdf", "org-lamentin"]) {
    const orgFamilies = familyList.filter((f) => f.organizationId === org).slice(0, 4);
    const source = org === "org-fdf" ? "portail-familles-fdf" : "espace-citoyens-lamentin";
    for (const entity of ["families", "inscriptions", "reservations", "payments", "absences"]) {
      integrationRows.push({
        id: uid("int"), organizationId: org, source, entityType: entity, direction: "INBOUND",
        status: "NORMALIZED",
        payload: { source, entity, batch: `${entity.toUpperCase()}-2026-11`, records: [
          { externalId: orgFamilies[0]?.externalId, nom: orgFamilies[0]?.lastName, prenom: orgFamilies[0]?.firstName, date: today },
        ] },
        normalized: { organizationId: org, entity, records: 1, mappedAt: now.toISOString() },
        receivedAt: addDays(now, -1),
      });
    }
  }
  insertAll(s.integrationEvents, integrationRows);

  // --- Journal d'audit complémentaire ----------------------------------
  ["USER_LOGIN", "DATA_SYNCED", "SETTINGS_UPDATED"].forEach((action) => {
    for (const org of ["org-fdf", "org-lamentin"]) {
      auditRows.push({
        id: uid("log"), organizationId: org, actorId: director.id, actorName: director.name,
        action, entityType: "system", entityId: org, detail: `Événement de démonstration ${action}`,
      });
    }
  });
  insertAll(s.auditLogs, auditRows);

  return {
    seeded: true,
    organizations: 2,
    users: db.select().from(s.users).all().length,
    children: db.select().from(s.children).all().length,
    attendance: attendanceRows.length,
    predictions: predictionRows.length,
    aidRequests: aidRows.length,
  };
}
