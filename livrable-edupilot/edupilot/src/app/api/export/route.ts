import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { aidRequests, attendance, organizations, predictions, wasteRecords } from "@/db/schema";
import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import { isoDay, money } from "@/lib/utils";
import { buildPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

const CSV_SEP = ";";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "export:write")) {
    return new Response("Accès refusé", { status: 403 });
  }
  const orgId = session.user.organizationId;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "csv";
  const doc = url.searchParams.get("doc") ?? "crc";
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return new Response("Caisse introuvable", { status: 404 });

  const prev = await db.select().from(predictions)
    .where(and(eq(predictions.organizationId, orgId), gte(predictions.date, isoDay(0))))
    .orderBy(predictions.date).limit(200);
  const waste = await db.select().from(wasteRecords)
    .where(and(eq(wasteRecords.organizationId, orgId), gte(wasteRecords.date, isoDay(-30))))
    .orderBy(wasteRecords.date).limit(200);
  const aids = await db.select().from(aidRequests).where(eq(aidRequests.organizationId, orgId)).limit(200);
  const att = await db.select().from(attendance)
    .where(and(eq(attendance.organizationId, orgId), gte(attendance.date, isoDay(-30)))).limit(500);
  const spent = att.reduce((sum, a) => sum + a.covers * 3.25, 0);

  if (type === "pdf") {
    const title = doc === "m14" ? "Etat M14 - Consommation" : "Rapport CRC - Synthese";
    const lines = [
      { text: "REPUBLIQUE FRANCAISE - COLLECTIVITE TERRITORIALE", size: 9, bold: true },
      { text: `${org.name} - ${org.city}`, size: 11, bold: true },
      { text: "", size: 8 },
      { text: title.toUpperCase(), size: 16, bold: true },
      { text: `Exercice ${new Date().getFullYear()} - edition du ${new Date().toLocaleDateString("fr-FR")}`, size: 10 },
      { text: "", size: 8 },
      { text: `Budget annuel : ${money(org.budget)}`, size: 11, bold: true },
      { text: `Depense estimee (30 derniers jours) : ${money(spent)}`, size: 11 },
      { text: `Taux de consommation : ${((spent / org.budget) * 100).toFixed(1)} %`, size: 11 },
      { text: "", size: 8 },
      { text: `Previsions IA en attente : ${prev.filter((p) => p.status === "SUGGESTED").length}`, size: 11 },
      { text: `Dossiers d'aide : ${aids.length} (${aids.filter((a) => a.status === "VALIDATED").length} valides)`, size: 11 },
      { text: `Releves de pertes : ${waste.length}`, size: 11 },
      { text: "", size: 8 },
      { text: "Document genere localement par EduPilot (mock CRC/M14 - valeur indicative).", size: 9 },
      { text: "Toute decision definitive reste de la competence de l'ordonnateur.", size: 9 },
    ];
    return new Response(buildPdf(lines, title), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="edupilot-${doc}.pdf"`,
      },
    });
  }

  const rows = [
    ["Date", "Etablissement", "Type", "Valeur", "Statut"],
    ...prev.map((p) => [p.date, p.schoolId, "Prevision couverts", String(p.predictedCovers), p.status]),
    ...waste.map((w) => [w.date, w.schoolId, "Pertes kg", String(w.wasteKg), "Saisi"]),
    ...aids.map((a) => [a.depositedAt.toISOString().slice(0, 10), a.reference, "Aide sociale", String(a.finalAmount ?? a.suggestedAmount ?? 0), a.status]),
  ];
  const csv = `\uFEFF${rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(CSV_SEP)).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edupilot-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
