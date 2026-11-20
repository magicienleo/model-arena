import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { AppShell } from "@/components/layout/app-shell";
import { ensureSeeded } from "@/lib/bootstrap";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded();
  const user = await requireUser();
  const [row] = await db.select({ total: count() }).from(alerts)
    .where(eq(alerts.organizationId, user.organizationId));

  return (
    <AppShell user={{
      name: user.name ?? "Agent",
      email: user.email ?? "",
      role: user.role,
      orgName: user.orgName ?? "Caisse des Écoles",
    }} alertCount={row?.total ?? 0}>
      {children}
    </AppShell>
  );
}
