import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ensureLocalDirs, DB_PATH, MIGRATIONS_DIR } from "@/lib/env";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  edupilotSqlite?: Database.Database;
  edupilotDb?: Db;
};

export function getSqlite() {
  ensureLocalDirs();
  if (!globalForDb.edupilotSqlite) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    globalForDb.edupilotSqlite = sqlite;
  }
  return globalForDb.edupilotSqlite;
}

/** Crée le schéma au premier lancement : `pnpm dev` suffit, aucun service à installer. */
export function initDb() {
  if (globalForDb.edupilotDb) return globalForDb.edupilotDb;
  const sqlite = getSqlite();
  if (!fs.existsSync(pathJoin(MIGRATIONS_DIR, "meta", "_journal.json"))) {
    throw new Error("Migrations Drizzle introuvables (dossier drizzle/).");
  }
  migrate(drizzle(sqlite, { schema }), { migrationsFolder: MIGRATIONS_DIR });
  globalForDb.edupilotDb = drizzle(sqlite, { schema });
  return globalForDb.edupilotDb;
}

function pathJoin(...parts: string[]) {
  return parts.join(process.platform === "win32" ? "\\" : "/");
}

export const db = initDb();
