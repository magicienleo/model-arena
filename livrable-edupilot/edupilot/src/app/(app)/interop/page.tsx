import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrationEvents } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { MOCK_ENTITIES } from "@/lib/mocks/portals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, AlertStrip, EmptyState } from "@/components/ui/misc";
import { SyncButton } from "@/components/interop/sync-button";
import { PayloadDialog } from "@/components/interop/payload-dialog";
import { ArrowRightLeft, Database, Globe2, Radio, ShieldCheck, Webhook } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interopérabilité" };

const SOURCES = [
  {
    id: "portail-familles-fdf",
    name: "Portail Familles · Fort-de-France",
    org: "org-fdf",
    description: "Familles, inscriptions, réservations, paiements et absences de la Caisse de Fort-de-France.",
    color: "from-blue-500 to-navy-800",
  },
  {
    id: "espace-citoyens-lamentin",
    name: "Espace Citoyens · Le Lamentin",
    org: "org-lamentin",
    description: "Flux equivalents pour la Caisse du Lamentin, normalises dans le meme modele de donnees.",
    color: "from-teal-500 to-emerald-800",
  },
];

const ENTITY_LABELS: Record<string, string> = {
  families: "Familles",
  inscriptions: "Inscriptions",
  reservations: "Réservations",
  payments: "Paiements",
  absences: "Absences",
};

export default async function InteropPage() {
  const user = await requirePermission("interop:read");
  const events = await db.select().from(integrationEvents)
    .where(eq(integrationEvents.organizationId, user.organizationId))
    .orderBy(desc(integrationEvents.receivedAt)).limit(30);
  const canSync = can(user.role, "interop:sync");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Interopérabilité"
        title="Échange avec les portails"
        description="Mocks propres des flux entrants. Les charges utiles brutes et normalisées sont conservées dans la base SQLite locale."
      />

      <AlertStrip variant="info" title="Environnement de démonstration :">
        Aucun appel réseau n&apos;est effectué. Les boutons génèrent des charges utiles réalistes et simulent la synchronisation.
      </AlertStrip>

      <div className="grid gap-5 lg:grid-cols-2">
        {SOURCES.map((source) => (
          <Card key={source.id} className="overflow-hidden">
            <div className={`h-1.5 bg-gradient-to-r ${source.color}`} />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${source.color} text-white`}><Globe2 className="size-5" /></span>
                  <div><CardTitle>{source.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{source.description}</p></div>
                </div>
                <Badge variant={source.org === user.organizationId ? "success" : "outline"}>
                  {source.org === user.organizationId ? "Votre caisse" : "Autre caisse"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_ENTITIES.map((entity) => (
                <div key={entity} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ArrowRightLeft className="size-4 text-muted-foreground" /> {ENTITY_LABELS[entity]}
                  </div>
                  {source.org === user.organizationId
                    ? canSync ? <SyncButton source={source.id} entity={entity} /> : <Badge variant="outline">Lecture seule</Badge>
                    : <Badge variant="outline">Non autorisé</Badge>}
                </div>
              ))}
              <p className="pt-2 text-[11px] text-muted-foreground">Flux : {source.id} · format JSON v1.2</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="size-4 text-primary" /> Récepteur de webhook mock</CardTitle><p className="text-xs text-muted-foreground">Endpoint local prêt à recevoir des événements</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-navy-950 p-4 font-mono text-xs text-emerald-200">
            POST /api/webhooks/&#123;source&#125;<br />
            <span className="text-navy-300">x-organization-id: org-fdf | org-lamentin</span><br />
            <span className="text-navy-300">Content-Type: application/json</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Les charges reçues sont stockées telles quelles dans integration_events, puis consultables ci-dessous.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><Database className="size-4 text-primary" /> Flux reçus</CardTitle><p className="text-xs text-muted-foreground">Charges utiles brutes et normalisées · {events.length} événements</p></div>
          <Badge variant="success"><Radio className="mr-1 size-3" /> local</Badge>
        </CardHeader>
        <CardContent>
          {events.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>{["Date", "Source", "Type", "Statut", "Enregistrements", "Payload"].map((h) => <th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border/70 bg-white">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="px-3 py-3 text-xs">{formatDateTime(event.receivedAt)}</td>
                      <td className="px-3 py-3 text-xs font-semibold">{event.source}</td>
                      <td className="px-3 py-3">{ENTITY_LABELS[event.entityType] ?? event.entityType}</td>
                      <td className="px-3 py-3"><Badge variant={event.status === "NORMALIZED" ? "success" : "warning"}>{event.status}</Badge></td>
                      <td className="px-3 py-3">{(event.normalized as { records?: number } | null)?.records ?? "—"}</td>
                      <td className="px-3 py-3"><PayloadDialog title={`${event.entityType} · ${event.source}`} subtitle="Charge utile brut et données normalisées" payload={{ raw: event.payload, normalized: event.normalized }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={Database} title="Aucun flux reçu" description="Utilisez un bouton de synchronisation ou le webhook pour générer un événement." />}
        </CardContent>
      </Card>
    </div>
  );
}
