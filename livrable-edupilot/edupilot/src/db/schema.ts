/**
 * Schéma Drizzle — une seule base SQLite locale : ./data/edupilot.db
 * Toutes les tables métier portent un organizationId (isolation multi-caisse).
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { Role } from "@/lib/permissions";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  city: text("city").notNull(),
  siret: text("siret"),
  sourceSystem: text("source_system").notNull(), // portail-familles-fdf | espace-citoyens-lamentin
  budget: real("budget").notNull().default(0), // euros, exercice en cours
  alertThresholdWaste: real("alert_threshold_waste").notNull().default(0.12),
  alertThresholdOccupancy: real("alert_threshold_occupancy").notNull().default(0.75),
  aidBareme: text("aid_bareme", { mode: "json" }).$type<Record<string, number>>()
    .notNull().default({ base: 120, partQ1: 65, partQ2: 45, partQ3: 25, max: 380 }),
  calendar: text("calendar", { mode: "json" }).$type<string[]>().notNull().default([]),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [uniqueIndex("users_email_unique").on(t.email), index("users_org_idx").on(t.organizationId)]);

// Tables requises par le adaptateur NextAuth (SQLite via Drizzle).
export const accounts = sqliteTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [uniqueIndex("accounts_provider_unique").on(t.provider, t.providerAccountId)]);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
}, (t) => [uniqueIndex("verification_tokens_unique").on(t.identifier, t.token)]);

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  city: text("city").notNull(),
  district: text("district"),
  capacity: integer("capacity").notNull().default(120),
  directorName: text("director_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("schools_org_idx").on(t.organizationId)]);

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  externalId: text("external_id"),
  source: text("source").notNull().default("mock"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  quotientFamilial: integer("quotient_familial").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("families_org_idx").on(t.organizationId), uniqueIndex("families_external_unique").on(t.organizationId, t.externalId)]);

export const children = sqliteTable("children", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  familyId: text("family_id").references(() => families.id, { onDelete: "cascade" }),
  schoolId: text("school_id").notNull().references(() => schools.id),
  externalId: text("external_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: text("birth_date").notNull(),
  className: text("class_name").notNull(),
  allergenNote: text("allergen_note"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("children_org_idx").on(t.organizationId), index("children_school_idx").on(t.schoolId)]);

/** Présence réelle constatée (table d'entrainement du modèle). */
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  date: text("date").notNull(), // YYYY-MM-DD
  expected: integer("expected").notNull(),
  covers: integer("covers").notNull(),
  source: text("source").notNull().default("seed"),
}, (t) => [uniqueIndex("attendance_org_school_date").on(t.organizationId, t.schoolId, t.date), index("attendance_date_idx").on(t.date)]);

export const wasteRecords = sqliteTable("waste_records", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  date: text("date").notNull(),
  covers: integer("covers").notNull(),
  preparedMeals: integer("prepared_meals").notNull(),
  wasteKg: real("waste_kg").notNull(),
  wasteCost: real("waste_cost").notNull(),
  menuLabel: text("menu_label"),
  note: text("note"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("waste_org_date_idx").on(t.organizationId, t.date)]);

/** Sortie brute du modèle statistique, avant toute décision humaine. */
export const predictions = sqliteTable("predictions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  date: text("date").notNull(), // jour concerné
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  horizonDays: integer("horizon_days").notNull().default(7),
  predictedCovers: integer("predicted_covers").notNull(),
  lowerBound: integer("lower_bound").notNull(),
  upperBound: integer("upper_bound").notNull(),
  confidence: real("confidence").notNull(), // 0..1
  recommendedMeals: integer("recommended_meals").notNull(),
  expectedWasteKg: real("expected_waste_kg").notNull(),
  features: text("features", { mode: "json" }).$type<Array<{ label: string; impact: number }>>().notNull().default([]),
  modelVersion: text("model_version").notNull().default("edupilot-ts-v1"),
  status: text("status").$type<"SUGGESTED" | "VALIDATED" | "REJECTED">().notNull().default("SUGGESTED"),
}, (t) => [uniqueIndex("predictions_org_school_date").on(t.organizationId, t.schoolId, t.date), index("predictions_status_idx").on(t.status)]);

/** Trace immuable : suggestion IA + décision humaine finale. */
export const predictionValidations = sqliteTable("prediction_validations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  predictionId: text("prediction_id").notNull().references(() => predictions.id, { onDelete: "cascade" }),
  validatorId: text("validator_id").notNull().references(() => users.id),
  aiCovers: integer("ai_covers").notNull(),
  humanCovers: integer("human_covers").notNull(),
  aiMeals: integer("ai_meals").notNull(),
  humanMeals: integer("human_meals").notNull(),
  deltaCovers: integer("delta_covers").notNull(),
  reason: text("reason"),
  decidedAt: integer("decided_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("predval_org_idx").on(t.organizationId)]);

export const aidRequests = sqliteTable("aid_requests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  familyId: text("family_id").references(() => families.id, { onDelete: "set null" }),
  childId: text("child_id").references(() => children.id, { onDelete: "set null" }),
  reference: text("reference").notNull(),
  applicantName: text("applicant_name").notNull(),
  quotientFamilial: integer("quotient_familial").notNull(),
  amountAsked: real("amount_asked").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").$type<"DEPOSITED" | "SCORED" | "VALIDATED" | "REJECTED">().notNull().default("DEPOSITED"),
  score: integer("score"),
  suggestedAmount: real("suggested_amount"),
  finalAmount: real("final_amount"),
  scoreExplanation: text("score_explanation", { mode: "json" }).$type<Array<{ label: string; points: number }>>(),
  ocrPayload: text("ocr_payload", { mode: "json" }).$type<Record<string, unknown>>(),
  source: text("source").notNull().default("portail-familles"),
  depositedAt: integer("deposited_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
}, (t) => [index("aid_org_status_idx").on(t.organizationId, t.status), uniqueIndex("aid_ref_unique").on(t.reference)]);

export const aidDocuments = sqliteTable("aid_documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  aidRequestId: text("aid_request_id").notNull().references(() => aidRequests.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  storedPath: text("stored_path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  ocrText: text("ocr_text"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const aidValidations = sqliteTable("aid_validations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  aidRequestId: text("aid_request_id").notNull().references(() => aidRequests.id, { onDelete: "cascade" }),
  validatorId: text("validator_id").notNull().references(() => users.id),
  decision: text("decision").$type<"APPROVED" | "REJECTED">().notNull(),
  aiAmount: real("ai_amount").notNull(),
  humanAmount: real("human_amount").notNull(),
  reason: text("reason"),
  decidedAt: integer("decided_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const haccpChecks = sqliteTable("haccp_checks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  date: text("date").notNull(),
  checkType: text("check_type").notNull(), // RECEPTION | STOCKAGE | CUISSE | NETTOYAGE
  temperature: real("temperature"),
  productLabel: text("product_label"),
  dlc: text("dlc"),
  conform: integer("conform", { mode: "boolean" }).notNull(),
  note: text("note"),
  checkedBy: text("checked_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("haccp_org_date_idx").on(t.organizationId, t.date)]);

export const haccpPhotos = sqliteTable("haccp_photos", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  checkId: text("check_id").references(() => haccpChecks.id, { onDelete: "cascade" }),
  storedPath: text("stored_path").notNull(),
  fileName: text("file_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: text("position").notNull(),
  schoolId: text("school_id").references(() => schools.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const planningShifts = sqliteTable("planning_shifts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  startHour: text("start_hour").notNull(),
  endHour: text("end_hour").notNull(),
  expectedCovers: integer("expected_covers").notNull().default(0),
  status: text("status").$type<"PLANNED" | "CLOCKED_IN" | "CLOCKED_OUT">().notNull().default("PLANNED"),
}, (t) => [index("shifts_org_date_idx").on(t.organizationId, t.date)]);

export const timeClocks = sqliteTable("time_clocks", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  shiftId: text("shift_id").notNull().references(() => planningShifts.id, { onDelete: "cascade" }),
  clockIn: integer("clock_in", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  clockOut: integer("clock_out", { mode: "timestamp" }),
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  severity: text("severity").$type<"INFO" | "WARNING" | "CRITICAL">().notNull(),
  category: text("category").notNull(), // RESTAURATION | AIDES | HACCP | BUDGET | INTEROP
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("alerts_org_idx").on(t.organizationId, t.isRead)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  actorId: text("actor_id").references(() => users.id),
  actorName: text("actor_name").notNull().default("système"),
  action: text("action").notNull(), // PREDICTION_GENERATED | PREDICTION_VALIDATED | ...
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  aiSuggestion: text("ai_suggestion", { mode: "json" }),
  humanDecision: text("human_decision", { mode: "json" }),
  detail: text("detail").notNull().default(""),
  ip: text("ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("audit_org_date_idx").on(t.organizationId, t.createdAt)]);

/** Charges JSON reçues des mocks d'interopérabilité. */
export const integrationEvents = sqliteTable("integration_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  source: text("source").notNull(), // portail-familles-fdf | espace-citoyens-lamentin | webhook
  entityType: text("entity_type").notNull(), // families | inscriptions | reservations | payments | absences
  direction: text("direction").$type<"INBOUND" | "OUTBOUND">().notNull().default("INBOUND"),
  status: text("status").$type<"RECEIVED" | "NORMALIZED" | "ERROR">().notNull().default("RECEIVED"),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  normalized: text("normalized", { mode: "json" }).$type<Record<string, unknown>>(),
  receivedAt: integer("received_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("integration_org_idx").on(t.organizationId, t.source)]);

export const menus = sqliteTable("menus", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  date: text("date").notNull(),
  label: text("label").notNull(),
  products: text("products", { mode: "json" }).$type<string[]>().notNull().default([]),
}, (t) => [uniqueIndex("menus_org_date").on(t.organizationId, t.date)]);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Family = typeof families.$inferSelect;
export type Child = typeof children.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type AidRequest = typeof aidRequests.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PlanningShift = typeof planningShifts.$inferSelect;
