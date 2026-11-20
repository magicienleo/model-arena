import path from "node:path";
import fs from "node:fs";

/** Tous les chemins sont locaux au dossier applicatif : aucun service externe. */
export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const DB_PATH = path.join(DATA_DIR, "edupilot.db");
export const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
export const MIGRATIONS_DIR = path.join(ROOT_DIR, "drizzle");

export function ensureLocalDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, path.join(UPLOAD_DIR, "aides"), path.join(UPLOAD_DIR, "haccp")]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function safeUploadPath(relative: string) {
  const resolved = path.resolve(UPLOAD_DIR, relative);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    throw new Error("Chemin de fichier invalide");
  }
  return resolved;
}
