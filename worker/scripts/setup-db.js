import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function init() {
  console.log("Connecting to Turso database...");
  const sqlPath = path.resolve(__dirname, "../../scripts/setup-db.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    console.log(`Executing: ${statement.slice(0, 50)}...`);
    await client.execute(statement);
  }

  console.log("Database initialized successfully!");
}

init().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
