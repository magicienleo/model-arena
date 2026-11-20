import type { Role } from "@/lib/permissions";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: Role;
    organizationId?: string;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      organizationId: string;
      orgName: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    organizationId?: string;
    orgName?: string;
  }
}
