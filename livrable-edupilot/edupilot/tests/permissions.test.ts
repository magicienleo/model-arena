import { describe, expect, it } from "vitest";
import { can, NAV_ITEMS, ROLES, type Role } from "@/lib/permissions";

describe("RBAC multi-rôles", () => {
  it("autorise la direction et l'admin sur toutes les actions", () => {
    for (const role of ["DIRECTOR", "ADMIN"] as Role[]) {
      expect(can(role, "predictions:validate")).toBe(true);
      expect(can(role, "aides:validate")).toBe(true);
      expect(can(role, "admin:write")).toBe(true);
    }
  });

  it("interdit la validation IA aux rôles non habilités", () => {
    expect(can("STAFF", "predictions:validate")).toBe(false);
    expect(can("FINANCE", "aides:validate")).toBe(false);
    expect(can("RESTAURATION_MANAGER", "aides:validate")).toBe(false);
    expect(can("AID_AGENT", "predictions:validate")).toBe(false);
  });

  it("limite la navigation et refuse un rôle inconnu", () => {
    for (const role of ROLES) {
      expect(can(role, "dashboard:read")).toBe(true);
      expect(NAV_ITEMS.some((item) => can(role, item.permission))).toBe(true);
    }
    expect(can(undefined, "dashboard:read")).toBe(false);
    expect(can("UNKNOWN" as Role, "admin:write")).toBe(false);
  });
});
