import "dotenv/config";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("[wait] database siap.");
      return;
    } catch {
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }
  throw new Error("Database tidak siap dalam 90 detik.");
}

void main().catch((error: unknown) => {
  console.error("[wait]", error instanceof Error ? error.message : error);
  process.exit(1);
});
