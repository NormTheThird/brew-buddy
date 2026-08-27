import path from "node:path";

/** Where receipt uploads live on disk — next to the SQLite file. */
export function receiptsDir(): string {
  return path.join(
    path.dirname(process.env.DATABASE_PATH ?? "./data/brewbuddy.db"),
    "receipts"
  );
}
