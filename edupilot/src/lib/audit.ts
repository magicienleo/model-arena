import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { uid } from "@/lib/utils";
import type { Session } from "next-auth";

type AuditInput = {
  organizationId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  aiSuggestion?: unknown;
  humanDecision?: unknown;
  detail?: string;
  ip?: string;
};

/** Toutes les décisions IA + humaines sont tracées dans la base locale. */
export function logAudit(input: AuditInput) {
  db.insert(auditLogs).values({
    id: uid("log"),
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? "système",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    aiSuggestion: input.aiSuggestion ?? null,
    humanDecision: input.humanDecision ?? null,
    detail: input.detail ?? "",
    ip: input.ip ?? null,
  }).run();
}

export function auditFromSession(session: Session | null, input: Omit<AuditInput, "organizationId" | "actorId" | "actorName">) {
  if (!session?.user?.organizationId) return;
  logAudit({
    ...input,
    organizationId: session.user.organizationId,
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "utilisateur",
  });
}
