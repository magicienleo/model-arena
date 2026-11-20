/** Calendrier martiniquais, calculé localement (aucun service externe). */

export type CalendarEvent = { date: string; label: string; kind: "HOLIDAY" | "CARNIVAL" | "VACATION" };

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysIso(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Algorithme de Meeus (dimanche de Pâques grégorien). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function martiniqueEvents(fromYear: number, toYear: number): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    const easterDay = easter(year).toISOString().slice(0, 10);
    const mardiGras = addDaysIso(easterDay, -47);
    const mercrediCendres = addDaysIso(easterDay, -46);
    events.push(
      { date: iso(year, 1, 1), label: "Jour de l'an", kind: "HOLIDAY" },
      { date: mardiGras, label: "Mardi Gras (Carnaval)", kind: "CARNIVAL" },
      { date: mercrediCendres, label: "Mercredi des Cendres", kind: "CARNIVAL" },
      { date: addDaysIso(easterDay, -2), label: "Vendredi saint", kind: "HOLIDAY" },
      { date: addDaysIso(easterDay, 1), label: "Lundi de Pâques", kind: "HOLIDAY" },
      { date: iso(year, 5, 1), label: "Fête du Travail", kind: "HOLIDAY" },
      { date: iso(year, 5, 8), label: "Victoire 1945", kind: "HOLIDAY" },
      { date: iso(year, 5, 23), label: "Abolition de l'esclavage", kind: "HOLIDAY" },
      { date: iso(year, 7, 14), label: "Fête nationale", kind: "HOLIDAY" },
      { date: iso(year, 8, 15), label: "Assomption", kind: "HOLIDAY" },
      { date: iso(year, 11, 1), label: "Toussaint", kind: "HOLIDAY" },
      { date: iso(year, 11, 11), label: "Armistice 1918", kind: "HOLIDAY" },
      { date: iso(year, 12, 25), label: "Noël", kind: "HOLIDAY" },
      { date: iso(year, 7, 6), label: "Grandes vacances", kind: "VACATION" },
      { date: iso(year, 8, 31), label: "Rentrée scolaire", kind: "VACATION" },
    );
    // Vacances de Pâques (3 semaines à partir du lundi suivant Pâques).
    for (let i = 2; i <= 20; i++) {
      events.push({ date: addDaysIso(easterDay, i), label: "Vacances de Pâques", kind: "VACATION" });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/** Température simulée (saisonnalité tropicale + bruit déterministe) : utilisée comme feature. */
export function estimatedHeat(dateISO: string) {
  const day = new Date(`${dateISO}T12:00:00Z`);
  const start = Date.UTC(day.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((day.getTime() - start) / 86_400_000);
  const seasonal = 28.5 + 3.2 * Math.sin(((dayOfYear - 100) / 365) * 2 * Math.PI);
  const seed = dayOfYear * 37;
  const noise = ((seed % 17) - 8) / 8;
  return Math.round((seasonal + noise) * 10) / 10;
}
