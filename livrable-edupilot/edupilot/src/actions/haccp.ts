"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { alerts, haccpChecks, haccpPhotos, schools } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { safeUploadPath } from "@/lib/env";
import { uid } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

export async function createHaccpCheckAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("haccp:write");
    const parsed = z.object({
      schoolId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      checkType: z.enum(["RECEPTION", "STOCKAGE", "CUISSE", "NETTOYAGE"]),
      temperature: z.coerce.number().min(-30).max(200),
      productLabel: z.string().max(120).optional(),
      dlc: z.string().optional(),
      note: z.string().max(400).optional(),
      conform: z.enum(["true", "false"]),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs du contrôle." };
    const [school] = await db.select().from(schools)
      .where(eq(schools.id, parsed.data.schoolId)).limit(1);
    if (!school || school.organizationId !== user.organizationId) return { ok: false, message: "Établissement invalide." };

    const conform = parsed.data.conform === "true";
    const id = uid("hac");
    await db.insert(haccpChecks).values({
      id, organizationId: user.organizationId, schoolId: school.id, date: parsed.data.date,
      checkType: parsed.data.checkType, temperature: parsed.data.temperature,
      productLabel: parsed.data.productLabel || null, dlc: parsed.data.dlc || null,
      conform, note: parsed.data.note || "", checkedBy: user.id,
    });

    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0 && photo.size < 5 * 1024 * 1024) {
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-70);
      const relative = path.join("haccp", user.organizationId, `${id}-${safeName}`);
      const absolute = safeUploadPath(relative);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, Buffer.from(await photo.arrayBuffer()));
      await db.insert(haccpPhotos).values({
        id: uid("pho"), organizationId: user.organizationId, checkId: id,
        storedPath: relative, fileName: safeName,
      });
    }

    if (!conform) {
      await db.insert(alerts).values({
        id: uid("alert"), organizationId: user.organizationId, severity: "CRITICAL", category: "HACCP",
        title: "Non-conformité HACCP déclarée",
        message: `${parsed.data.checkType} — ${school.name} : ${parsed.data.note || "écart de température"}`,
        link: "/haccp",
      });
    }
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: conform ? "HACCP_CHECK_CONFORM" : "HACCP_NONCONFORMITY", entityType: "haccp_check", entityId: id,
      humanDecision: { conform, temperature: parsed.data.temperature }, detail: `Contrôle ${parsed.data.checkType} — ${school.name}`,
    });
    revalidatePath("/haccp");
    revalidatePath("/dashboard");
    return { ok: true, message: conform ? "Contrôle enregistré." : "Non-conformité enregistrée et alertée." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Enregistrement impossible." };
  }
}
