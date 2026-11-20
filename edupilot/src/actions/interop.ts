"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { families, integrationEvents } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { mockPayload, MOCK_ENTITIES, normalizePayload, type MockEntity } from "@/lib/mocks/portals";
import { uid } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

export async function syncMockAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("interop:sync");
    const parsed = z.object({
      source: z.enum(["portail-familles-fdf", "espace-citoyens-lamentin"]),
      entity: z.enum(MOCK_ENTITIES as [MockEntity, ...MockEntity[]]),
    }).safeParse({ source: formData.get("source"), entity: formData.get("entity") });
    if (!parsed.success) return { ok: false, message: "Paramètres de synchronisation invalides." };
    if (parsed.data.source === "portail-familles-fdf" && user.organizationId !== "org-fdf") {
      return { ok: false, message: "Ce flux appartient à la Caisse de Fort-de-France." };
    }
    if (parsed.data.source === "espace-citoyens-lamentin" && user.organizationId !== "org-lamentin") {
      return { ok: false, message: "Ce flux appartient à la Caisse du Lamentin." };
    }

    const payload = mockPayload(parsed.data.source, parsed.data.entity, user.organizationId) as Record<string, unknown>;
    const normalized = normalizePayload(parsed.data.source, parsed.data.entity, payload);
    await db.insert(integrationEvents).values({
      id: uid("int"), organizationId: user.organizationId, source: parsed.data.source,
      entityType: parsed.data.entity, direction: "INBOUND", status: "NORMALIZED",
      payload, normalized,
    });

    if (parsed.data.entity === "families") {
      const record = (payload.data as Array<Record<string, string | number>>)[0];
      const externalId = String(record.external_id);
      const existing = await db.select().from(families).where(and(eq(families.organizationId, user.organizationId), eq(families.externalId, externalId))).limit(1);
      if (!existing.length) {
        await db.insert(families).values({
          id: uid("fam"), organizationId: user.organizationId, externalId,
          source: parsed.data.source, firstName: String(record.prenom), lastName: String(record.nom),
          phone: String(record.telephone), address: String(record.adresse),
          quotientFamilial: Number(record.quotient_familial),
        });
      }
    }
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "DATA_SYNCED", entityType: "integration", entityId: `${parsed.data.source}:${parsed.data.entity}`,
      aiSuggestion: null, humanDecision: { triggeredBy: user.name }, detail: "Synchronisation mock — charge utile normalisée en SQLite",
    });
    revalidatePath("/interop");
    revalidatePath("/dashboard");
    return { ok: true, message: `Flux ${parsed.data.entity} synchronisé et normalisé.` };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Synchronisation impossible." };
  }
}

export async function storeWebhookEvent(orgId: string, source: string, payload: Record<string, unknown>) {
  await db.insert(integrationEvents).values({
    id: uid("int"), organizationId: orgId, source: source || "webhook",
    entityType: typeof payload.entity === "string" ? payload.entity : "webhook",
    direction: "INBOUND", status: "RECEIVED", payload,
  });
  logAudit({
    organizationId: orgId, action: "WEBHOOK_RECEIVED", entityType: "integration",
    entityId: source, detail: "Charge utile reçue sur l'endpoint local",
  });
}
