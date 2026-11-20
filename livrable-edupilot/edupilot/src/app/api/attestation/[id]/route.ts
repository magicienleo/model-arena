import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aidRequests, organizations } from "@/db/schema";
import { auth } from "@/auth";
import { buildPdf } from "@/lib/pdf";
import { formatDay, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Accès refusé", { status: 403 });
  const { id } = await params;
  const [row] = await db.select().from(aidRequests)
    .where(and(eq(aidRequests.id, id), eq(aidRequests.organizationId, session.user.organizationId))).limit(1);
  if (!row) return new Response("Introuvable", { status: 404 });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, row.organizationId)).limit(1);
  const pdf = buildPdf([
    { text: "REPUBLIQUE FRANCAISE", size: 10, bold: true },
    { text: org?.name ?? "Caisse des Ecoles", size: 12, bold: true },
    { text: org?.city ?? "Martinique", size: 10 },
    { text: "", size: 8 },
    { text: "ATTESTATION D'AIDE SOCIALE", size: 17, bold: true },
    { text: `Reference : ${row.reference}`, size: 11 },
    { text: "", size: 8 },
    { text: `Beneficiaire : ${row.applicantName}`, size: 12, bold: true },
    { text: `Motif : ${row.reason}`, size: 11 },
    { text: `Montant accorde : ${money(row.finalAmount ?? 0)}`, size: 12, bold: true },
    { text: `Date de decision : ${row.decidedAt ? formatDay(row.decidedAt.toISOString().slice(0, 10)) : formatDay(row.depositedAt.toISOString().slice(0, 10))}`, size: 11 },
    { text: "", size: 8 },
    { text: "Decision prise par un agent humain apres scoring IA (IA Act - article 14).", size: 10 },
    { text: "Document genere localement par EduPilot. Valeur de demonstration.", size: 9 },
    { text: "", size: 8 },
    { text: "Pour le President de la Caisse des Ecoles", size: 10 },
    { text: "Signature", size: 10 },
  ], "Attestation aide sociale");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attestation-${row.reference}.pdf"`,
    },
  });
}
