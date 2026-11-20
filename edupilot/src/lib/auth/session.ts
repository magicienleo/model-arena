import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Permission } from "@/lib/permissions";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSession() {
  return auth();
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/** Vérifie à la fois l'authentification, le rôle et l'appartenance à l'organisation. */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard?error=acces-refuse");
  return user;
}

export async function requireOrg(orgId: string) {
  const user = await requireUser();
  if (user.organizationId !== orgId) throw new Error("Accès interdit à une autre caisse");
  return user;
}

export async function getOrganization() {
  const user = await requireUser();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
  if (!org) redirect("/login");
  return { user, org };
}

export async function requireRoleApi(permission: Permission) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Non authentifié" };
  if (!can(session.user.role, permission)) return { ok: false as const, status: 403, error: "Permissions insuffisantes" };
  return { ok: true as const, user: session.user };
}
