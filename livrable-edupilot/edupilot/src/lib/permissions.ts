import type { Session } from "next-auth";

export const ROLES = [
  "DIRECTOR",
  "RESTAURATION_MANAGER",
  "AID_AGENT",
  "FINANCE",
  "STAFF",
  "ADMIN",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  DIRECTOR: "Directeur / Directrice",
  RESTAURATION_MANAGER: "Responsable restauration",
  AID_AGENT: "Agent aides sociales",
  FINANCE: "Service financier",
  STAFF: "Agent de cuisine",
  ADMIN: "Administrateur",
};

export type Permission =
  | "dashboard:read"
  | "predictions:read"
  | "predictions:validate"
  | "predictions:generate"
  | "waste:write"
  | "aides:read"
  | "aides:score"
  | "aides:validate"
  | "interop:read"
  | "interop:sync"
  | "haccp:read"
  | "haccp:write"
  | "planning:read"
  | "planning:write"
  | "admin:read"
  | "admin:write"
  | "export:write";

const ALL: Permission[] = [
  "dashboard:read", "predictions:read", "predictions:validate", "predictions:generate",
  "waste:write", "aides:read", "aides:score", "aides:validate", "interop:read",
  "interop:sync", "haccp:read", "haccp:write", "planning:read", "planning:write",
  "admin:read", "admin:write", "export:write",
];

const MATRIX: Record<Role, Permission[]> = {
  DIRECTOR: ALL,
  RESTAURATION_MANAGER: [
    "dashboard:read", "predictions:read", "predictions:validate", "predictions:generate",
    "waste:write", "haccp:read", "haccp:write", "planning:read", "planning:write",
    "interop:read", "export:write",
  ],
  AID_AGENT: [
    "dashboard:read", "aides:read", "aides:score", "aides:validate",
    "interop:read", "interop:sync", "export:write",
  ],
  FINANCE: [
    "dashboard:read", "predictions:read", "aides:read", "interop:read",
    "export:write", "admin:read",
  ],
  STAFF: ["dashboard:read", "haccp:read", "haccp:write", "planning:read", "planning:write", "waste:write"],
  ADMIN: ALL,
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}

export function sessionRole(session: Session | null): Role | undefined {
  return session?.user?.role as Role | undefined;
}

export function sessionOrgId(session: Session | null): string | undefined {
  return (session?.user as { organizationId?: string } | undefined)?.organizationId;
}

export function sessionUserId(session: Session | null): string | undefined {
  return session?.user?.id;
}

/** Chemins de navigation affichés selon le rôle. */
export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: string;
  permission: Permission;
}> = [
  { href: "/dashboard", label: "Tableau de bord", icon: "LayoutDashboard", permission: "dashboard:read" },
  { href: "/predictions", label: "IA Restauration", icon: "Sparkles", permission: "predictions:read" },
  { href: "/aides", label: "Aides sociales", icon: "HandHeart", permission: "aides:read" },
  { href: "/haccp", label: "HACCP", icon: "ShieldCheck", permission: "haccp:read" },
  { href: "/planning", label: "Planning & pointage", icon: "CalendarDays", permission: "planning:read" },
  { href: "/interop", label: "Interopérabilité", icon: "PlugZap", permission: "interop:read" },
  { href: "/admin", label: "Administration", icon: "Settings2", permission: "admin:read" },
];
