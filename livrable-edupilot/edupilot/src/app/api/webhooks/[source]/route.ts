import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { storeWebhookEvent } from "@/actions/interop";

export const dynamic = "force-dynamic";

/** Endpoint de réception de webhook fictif : aucun appel sortant, tout est stocké localement. */
export async function POST(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  const orgId = request.headers.get("x-organization-id") ?? "org-fdf";
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return Response.json({ error: "Organisation inconnue" }, { status: 404 });
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  await storeWebhookEvent(orgId, source, payload);
  return Response.json({ received: true, stored_locally: true, source, organizationId: orgId }, { status: 200 });
}

export async function GET() {
  return Response.json({
    endpoint: "/api/webhooks/{source}",
    method: "POST",
    headers: { "x-organization-id": "org-fdf | org-lamentin" },
    example: { entity: "absences", data: [{ child_ref: "ENF-001", date: "2026-11-20" }] },
    note: "Mock local : aucune donnée ne quitte l'instance.",
  });
}
