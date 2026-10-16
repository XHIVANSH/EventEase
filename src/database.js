import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFolder = path.join(here, "..", "data");
export const DB_PATH = path.join(dataFolder, "eventease.db");

let db = null;

export function getDb() {
  if (!db) {
    fs.mkdirSync(dataFolder, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("foreign_keys = ON");
  }
  return db;
}
