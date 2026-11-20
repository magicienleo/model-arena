import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aidRequests, children, families } from "@/db/schema";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return new Response("Accès refusé", { status: 403 });
  const { id } = await params;
  const [family] = await db.select().from(families)
    .where(and(eq(families.id, id), eq(families.organizationId, session.user.organizationId))).limit(1);
  if (!family) return new Response("Introuvable", { status: 404 });
  const kids = await db.select().from(children).where(eq(children.familyId, family.id));
  const aids = await db.select().from(aidRequests).where(eq(aidRequests.familyId, family.id));
  logAudit({
    organizationId: session.user.organizationId, actorId: session.user.id, actorName: session.user.name ?? "admin",
    action: "RGPD_EXPORT", entityType: "family", entityId: family.id, detail: "Export JSON généré localement",
  });
  return Response.json({
    exported_at: new Date().toISOString(),
    organization_id: family.organizationId,
    family,
    children: kids,
    aid_requests: aids.map((aid) => ({ ...aid, ocrPayload: aid.ocrPayload })),
    note: "Export local — aucune donnée n'a quitté l'instance.",
  }, { headers: { "Content-Disposition": `attachment; filename="rgpd-${family.id}.json"` } });
}
