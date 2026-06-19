import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./pool.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const migrationsDir = path.resolve(currentDir, "../../migrations");

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const migrations = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const migration of migrations) {
      const existing = await client.query("select id from schema_migrations where id = $1", [migration]);

      if (existing.rowCount) {
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, migration), "utf8");
      await client.query(sql);
      await client.query("insert into schema_migrations (id) values ($1)", [migration]);
      console.log(`Applied ${migration}`);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
