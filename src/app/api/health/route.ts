import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const checks: Record<string, string> = {};
  let healthy = true;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = "ok";
  } catch (error: unknown) {
    healthy = false;
    checks.database = error instanceof Error ? error.message.slice(0, 120) : "error";
  }
  checks.app = "ok";
  checks.queue = process.env.REDIS_URL ? "redis-configured" : "inline-fallback";
  if (!healthy) logger.error("health check gagal", checks);
  return Response.json({ ok: healthy, service: "rasa-undangan", time: new Date().toISOString(), checks }, { status: healthy ? 200 : 503 });
}
