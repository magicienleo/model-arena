/**
 * Mocks d'interopérabilité : charges utiles conformes aux deux portails cibles.
 * Aucun appel réseau : les "sync" génèrent des données locales déterministes.
 */

export type MockEntity = "families" | "inscriptions" | "reservations" | "payments" | "absences";
export const MOCK_ENTITIES: MockEntity[] = ["families", "inscriptions", "reservations", "payments", "absences"];

export function mockPayload(source: string, entity: MockEntity, orgId: string) {
  const now = new Date().toISOString();
  const common = {
    source,
    entity,
    batch_id: `${source.toUpperCase()}-${entity.toUpperCase()}-${Date.now().toString(36)}`,
    emitted_at: now,
    schema_version: "1.2",
    organization_ref: orgId,
  };
  switch (entity) {
    case "families":
      return { ...common, data: [
        { external_id: `EXT-${orgId.slice(4, 6).toUpperCase()}-MOCK-${Math.floor(Math.random() * 900 + 100)}`, civilite: "MME", nom: "Marcelin", prenom: "Aline", telephone: "0696 12 34 56", adresse: "12 rue de la République, Fort-de-France", quotient_familial: 462, situation: "PARENT_ISOLE" },
      ] };
    case "inscriptions":
      return { ...common, data: [
        { external_id: "ENF-MOCK-001", family_ref: "EXT-FDF-1001", school_ref: "eco-01", classe: "CE2 A", date_entree: "2026-09-02", regime: "DEMI_PENSION" },
      ] };
    case "reservations":
      return { ...common, data: [
        { external_id: "RES-MOCK-001", child_ref: "ENF-MOCK-001", date: new Date().toISOString().slice(0, 10), repas: "DEJEUNER", menu: "Colombo de cabri" },
      ] };
    case "payments":
      return { ...common, data: [
        { external_id: "PAY-MOCK-001", family_ref: "EXT-FDF-1001", montant_eur: 48.5, mode: "PRELEVEMENT", statut: "PAYE" },
      ] };
    case "absences":
      return { ...common, data: [
        { external_id: "ABS-MOCK-001", child_ref: "ENF-MOCK-001", date: new Date().toISOString().slice(0, 10), motif: "MALADIE", justifiee: true },
      ] };
  }
}

export function normalizePayload(source: string, entity: MockEntity, payload: Record<string, unknown>) {
  return {
    source,
    entity,
    records: Array.isArray(payload.data) ? payload.data.length : 0,
    normalized_at: new Date().toISOString(),
    mapping: {
      external_id: "externalId",
      nom: "lastName",
      prenom: "firstName",
      telephone: "phone",
      quotient_familial: "quotientFamilial",
    },
  };
}
