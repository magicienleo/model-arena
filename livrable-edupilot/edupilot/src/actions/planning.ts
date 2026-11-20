"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { planningShifts, staff, timeClocks } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { uid } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

export async function clockAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("planning:write");
    const parsed = z.object({
      shiftId: z.string().min(1),
      action: z.enum(["IN", "OUT"]),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Action invalide." };
    const [shift] = await db.select().from(planningShifts)
      .where(and(eq(planningShifts.id, parsed.data.shiftId), eq(planningShifts.organizationId, user.organizationId))).limit(1);
    if (!shift) return { ok: false, message: "Poste introuvable." };
    const [clock] = await db.select().from(timeClocks).where(eq(timeClocks.shiftId, shift.id)).limit(1);

    if (parsed.data.action === "IN") {
      if (clock) return { ok: false, message: "Arrivée déjà pointée." };
      await db.insert(timeClocks).values({ id: uid("clock"), organizationId: user.organizationId, shiftId: shift.id, clockIn: new Date() });
      await db.update(planningShifts).set({ status: "CLOCKED_IN" }).where(eq(planningShifts.id, shift.id));
    } else {
      if (!clock || clock.clockOut) return { ok: false, message: "Aucune arrivée à clôturer." };
      await db.update(timeClocks).set({ clockOut: new Date() }).where(eq(timeClocks.id, clock.id));
      await db.update(planningShifts).set({ status: "CLOCKED_OUT" }).where(eq(planningShifts.id, shift.id));
    }
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: parsed.data.action === "IN" ? "CLOCK_IN" : "CLOCK_OUT", entityType: "shift", entityId: shift.id,
      humanDecision: { date: shift.date, action: parsed.data.action }, detail: "Pointage simple",
    });
    revalidatePath("/planning");
    return { ok: true, message: parsed.data.action === "IN" ? "Arrivée pointée." : "Départ pointé." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Pointage impossible." };
  }
}

export async function createShiftAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requirePermission("planning:write");
    const parsed = z.object({
      staffId: z.string().min(1), schoolId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startHour: z.string().regex(/^\d{2}:\d{2}$/),
      endHour: z.string().regex(/^\d{2}:\d{2}$/),
      expectedCovers: z.coerce.number().int().min(0).max(3000),
    }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs du poste." };
    const [member] = await db.select().from(staff)
      .where(and(eq(staff.id, parsed.data.staffId), eq(staff.organizationId, user.organizationId))).limit(1);
    if (!member) return { ok: false, message: "Agent introuvable." };
    await db.insert(planningShifts).values({
      id: uid("shift"), organizationId: user.organizationId, ...parsed.data, status: "PLANNED",
    });
    logAudit({
      organizationId: user.organizationId, actorId: user.id, actorName: user.name ?? "agent",
      action: "SHIFT_CREATED", entityType: "shift", entityId: parsed.data.date,
      aiSuggestion: { expectedCovers: parsed.data.expectedCovers }, detail: "Poste calqué sur la prévision IA",
    });
    revalidatePath("/planning");
    return { ok: true, message: "Poste ajouté au planning." };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Ajout impossible." };
  }
}
