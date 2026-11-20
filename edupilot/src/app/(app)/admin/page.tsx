import { eq } from "drizzle-orm";
import { db } from "@/db";
import { families, organizations } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { getAdminData } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, AlertStrip } from "@/components/ui/misc";
import { TabsShell } from "@/components/ui/tabs-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { UserDialog } from "@/components/admin/user-dialog";
import { AuditTable } from "@/components/admin/audit-table";
import { ResetPanel } from "@/components/admin/reset-panel";
import { toggleUserAction } from "@/actions/admin";
import { Download, ShieldCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const user = await requirePermission("admin:read");
  const data = await getAdminData(user.organizationId);
  const familyList = await db.select().from(families)
    .where(eq(families.organizationId, user.organizationId)).limit(300);
  const org = data.org ?? (await db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1))[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration & conformité"
        title="Administration"
        description="Paramètres de la caisse, agents, journal d'audit complet et cycle de vie des données."
        actions={<Badge variant="navy"><ShieldCheck className="size-3" /> Données 100 % locales</Badge>}
      />

      <AlertStrip variant="success" title="Souveraineté :">
        base SQLite unique <code>data/edupilot.db</code>, fichiers dans <code>./uploads</code>, aucun service externe requis.
      </AlertStrip>

      <TabsShell
        defaultValue="parametres"
        tabs={[
          {
            value: "parametres",
            label: "Paramètres",
            content: (
              <Card>
                <CardHeader><CardTitle>Configuration de la caisse</CardTitle><p className="text-xs text-muted-foreground">Budgets, seuils d&apos;alerte, barème des aides et calendrier martiniquais</p></CardHeader>
                <CardContent>{org && <SettingsForm org={org} />}</CardContent>
              </Card>
            ),
          },
          {
            value: "utilisateurs",
            label: "Utilisateurs",
            badge: String(data.orgUsers.length),
            content: (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div><CardTitle>Agents de la caisse</CardTitle><p className="text-xs text-muted-foreground">RBAC : chaque rôle limite les actions possibles</p></div>
                  <UserDialog />
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>{["Agent", "Rôle", "Statut", "Créé le", "Action"].map((h) => <th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-border/70 bg-white">
                        {data.orgUsers.map((agent) => (
                          <tr key={agent.id}>
                            <td className="px-3 py-3"><p className="font-semibold">{agent.name}</p><p className="text-xs text-muted-foreground">{agent.email}</p></td>
                            <td className="px-3 py-3"><Badge variant="default">{ROLE_LABELS[agent.role]}</Badge></td>
                            <td className="px-3 py-3"><Badge variant={agent.active ? "success" : "danger"}>{agent.active ? "Actif" : "Désactivé"}</Badge></td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(agent.createdAt)}</td>
                            <td className="px-3 py-3">
                              <form action={toggleUserAction}>
                                <input type="hidden" name="userId" value={agent.id} />
                                <Button size="sm" variant="ghost" disabled={agent.id === user.id}>{agent.active ? "Désactiver" : "Activer"}</Button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            value: "audit",
            label: "Journal d'audit",
            badge: String(data.logs.length),
            content: (
              <Card>
                <CardHeader><CardTitle>Journal immuable des décisions</CardTitle><p className="text-xs text-muted-foreground">Chaque suggestion IA est associée à la décision humaine finale</p></CardHeader>
                <CardContent><AuditTable logs={data.logs} /></CardContent>
              </Card>
            ),
          },
          {
            value: "donnees",
            label: "Données & RGPD",
            content: (
              <div className="space-y-5">
                <Card>
                  <CardHeader><CardTitle>Export des données personnelles</CardTitle><p className="text-xs text-muted-foreground">Droit à la portabilité (RGPD, art. 20)</p></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {familyList.slice(0, 6).map((family) => (
                        <Button key={family.id} asChild variant="outline" size="sm">
                          <a href={`/api/rgpd/family/${family.id}`}><Download className="size-4" /> {family.firstName} {family.lastName}</a>
                        </Button>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">Export JSON local des familles listées. Utilisez la recherche dans le panneau de suppression pour les autres.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4 text-primary" /> Cycle de vie des données</CardTitle></CardHeader>
                  <CardContent><ResetPanel families={familyList.map((f) => ({ id: f.id, label: `${f.firstName} ${f.lastName}` }))} /></CardContent>
                </Card>
              </div>
            ),
          },
          {
            value: "p1",
            label: "P1 · à venir",
            content: (
              <Card>
                <CardHeader><CardTitle>Fonctionnalités P1 (stubs non implémentés)</CardTitle></CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    {["OCR avancé (actuellement stub local)", "PWA hors-ligne complète (manifest présent)", "Édition CRC/M14 détaillée", "Chatbot interne", "Analytique multi-caisse avancée"].map((item) => (
                      <li key={item} className="rounded-xl border border-dashed border-border p-3">— {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
