"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, children, families, organizations, users } from "@/db/schema";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/permissions";
import { uid } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

export async function updateOrgSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("admin:write");
    const parsed = z.object({
      name: z.string().min(3).max(120),
      budget: z.coerce.number().min(0).max(1_000_000_000),
      thresholdWaste: z.coerce.number().min(0).max(1),
      thresholdOccupancy: z.coerce.number().min(0).max(1),
      base: z.coerce.number().min(0).max(5000),
      partQ1: z.coerce.number().min(0).max(5000),
      partQ2: z.coerce.number().min(0).max(5000),
      partQ3: z.coerce.number().min(0).max(5000),
      max: z.coerce.number().min(0).max(5000),
      calendar: z.string().max(500),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Valeurs invalides." };
    const calendar = parsed.data.calendar.split(/[,\n]/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    await db.update(organizations).set({
      name: parsed.data.name, budget: parsed.data.budget,
      alertThresholdWaste: parsed.data.thresholdWaste,
      alertThresholdOccupancy: parsed.data.thresholdOccupancy,
      aidBareme: { base: parsed.data.base, partQ1: parsed.data.partQ1, partQ2: parsed.data.partQ2, partQ3: parsed.data.partQ3, max: parsed.data.max },
      calendar,
    }).where(eq(organizations.id, user.organizationId));
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "admin",
      action: "SETTINGS_UPDATED", entityType: "organization", entityId: user.organizationId,
      humanDecision: { budget: parsed.data.budget, thresholds: [parsed.data.thresholdWaste, parsed.data.thresholdOccupancy] },
      detail: "Paramètres de la caisse mis à jour",
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { ok: true, message: "Paramètres enregistrés." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Mise à jour impossible." };
  }
}

export async function createUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("admin:write");
    const parsed = z.object({
      name: z.string().min(2).max(100),
      email: z.email().max(160),
      role: z.enum([...ROLES] as [Role, ...Role[]]),
      password: z.string().min(8).max(120),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Nom, e-mail valide et mot de passe de 8 caractères requis." };
    const existing = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
    if (existing.length) return { ok: false, message: "Cette adresse e-mail existe déjà." };
    await db.insert(users).values({
      id: uid("usr"), name: parsed.data.name, email: parsed.data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role, organizationId: user.organizationId, active: true, emailVerified: new Date(),
    });
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "admin",
      action: "USER_CREATED", entityType: "user", entityId: parsed.data.email,
      humanDecision: { role: parsed.data.role }, detail: "Compte agent créé",
    });
    revalidatePath("/admin");
    return { ok: true, message: "Compte créé." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Création impossible." };
  }
}

export async function toggleUserAction(formData: FormData) {
  const user = await requirePermission("admin:write");
  const targetId = String(formData.get("userId") ?? "");
  if (targetId === user.id) return;
  const [target] = await db.select().from(users)
    .where(and(eq(users.id, targetId), eq(users.organizationId, user.organizationId))).limit(1);
  if (!target) return;
  await db.update(users).set({ active: !target.active }).where(eq(users.id, target.id));
  logAudit({
    organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "admin",
    action: target.active ? "USER_DEACTIVATED" : "USER_ACTIVATED", entityType: "user", entityId: target.id,
    detail: `Compte ${target.email} ${target.active ? "désactivé" : "activé"}`,
  });
  revalidatePath("/admin");
}

export async function resetDataAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return { ok: false, message: "Réservé aux administrateurs." };
    if (String(formData.get("confirm") ?? "") !== "RESET") return { ok: false, message: "Confirmation incorrecte." };
    const { seedDatabase } = await import("../../scripts/seed-data");
    seedDatabase({ force: true });
    logAudit({
      organizationId: session.user.organizationId, actorId: session.user.id, actorName: session.user.name ?? "admin",
      action: "DATA_RESET", entityType: "system", entityId: session.user.organizationId,
      detail: "Jeu de données de démonstration régénéré",
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { ok: true, message: "Données régénérées. Actualisation de l'interface…" };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Réinitialisation impossible." };
  }
}

export async function rgpdDeleteFamilyAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return { ok: false, message: "Réservé aux administrateurs." };
    const familyId = String(formData.get("familyId") ?? "");
    const [family] = await db.select().from(families)
      .where(and(eq(families.id, familyId), eq(families.organizationId, session.user.organizationId))).limit(1);
    if (!family) return { ok: false, message: "Famille introuvable." };
    const kidCount = await db.select({ id: children.id }).from(children).where(eq(children.familyId, family.id));
    await db.delete(families).where(eq(families.id, family.id));
    logAudit({
      organizationId: session.user.organizationId, actorId: session.user.id, actorName: session.user.name ?? "admin",
      action: "RGPD_DELETE", entityType: "family", entityId: family.id,
      detail: `Famille et ${kidCount.length} enfant(s) supprimés (droit à l'effacement)`,
    });
    revalidatePath("/admin");
    return { ok: true, message: "Données supprimées de la base locale." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Suppression impossible." };
  }
}

export async function auditActionCount(orgId: string) {
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, orgId));
  return rows.length;
}
