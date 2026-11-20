import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, organizations, sessions, users, verificationTokens } from "@/db/schema";
import type { Role } from "@/lib/permissions";

const credentialsSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(6).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Adaptateur SQLite local (aucun service d'authentification externe).
  // Adaptateur Drizzle sur le même fichier SQLite (aucun service d'auth externe).
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? "edupilot-dev-secret-change-me-in-production-32chars",
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Identifiants de la Caisse",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Mot de passe", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          organizationId: user.organizationId,
          orgName: org?.shortName ?? "Caisse des Écoles",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.orgName = (user as { orgName?: string }).orgName;
      }
      return token;
    },
    async session({ session, token }) {
      const claims = token as typeof token & {
        id?: string; role?: Role; organizationId?: string; orgName?: string;
      };
      if (session.user) {
        session.user.id = claims.id ?? "";
        session.user.role = claims.role ?? "STAFF";
        session.user.organizationId = claims.organizationId ?? "";
        session.user.orgName = claims.orgName ?? "Caisse des Écoles";
      }
      return session;
    },
  },
});
