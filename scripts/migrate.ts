/**
 * Versioned SQL migration runner.
 * Setiap direktori prisma/migrations/<version>_<name>/migration.sql dijalankan
 * sekali, di dalam satu transaksi, dan dicatat di tabel _migrations beserta
 * checksum (perubahan file migrasi yang sudah diterapkan akan ditolak).
 * Tidak membutuhkan Prisma schema-engine binary -> bekerja offline.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/migrations");

type Migration = { version: string; file: string; sql: string; checksum: string };

function loadMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(MIGRATIONS_DIR, entry.name, "migration.sql");
      const sql = readFileSync(file, "utf8");
      return {
        version: entry.name,
        file,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    })
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diisi (lihat .env.example)");
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "version" TEXT PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const applied = await client.query<{ version: string; checksum: string }>(
      'SELECT "version", "checksum" FROM "_migrations"',
    );
    const done = new Map(applied.rows.map((row) => [row.version, row.checksum]));
    for (const migration of loadMigrations()) {
      const previous = done.get(migration.version);
      if (previous === migration.checksum) {
        console.log(`[migrate] skip  ${migration.version} (sudah diterapkan)`);
        continue;
      }
      if (previous) {
        throw new Error(
          `[migrate] checksum berubah untuk ${migration.version}. Migrasi yang sudah diterapkan tidak boleh diubah; buat migrasi baru.`,
        );
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO "_migrations" ("version", "checksum") VALUES ($1, $2)',
          [migration.version, migration.checksum],
        );
        await client.query("COMMIT");
        console.log(`[migrate] apply ${migration.version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("[migrate] skema siap.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("[migrate] gagal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
