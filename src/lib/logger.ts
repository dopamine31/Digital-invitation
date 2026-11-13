import { env } from "@/lib/env";

type Level = "debug" | "info" | "warn" | "error";
const WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Nomor HP/WA selalu dimasking sebelum keluar dari proses. */
function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(\+?62|0)8\d{6,12}/g, (match) => `${match.slice(0, 5)}****${match.slice(-2)}`);
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (/secret|password|token|authorization|apikey|api_key|cookie/i.test(key)) out[key] = "[redacted]";
      else out[key] = scrub(nested);
    }
    return out;
  }
  return value;
}

function write(level: Level, message: string, context: Record<string, unknown>): void {
  let configured: Level = "info";
  try {
    configured = env().LOG_LEVEL;
  } catch {
    configured = "info";
  }
  if (WEIGHT[level] < WEIGHT[configured]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(scrub(context) as Record<string, unknown>),
  });
  if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (msg: string, ctx: Record<string, unknown> = {}) => write("debug", msg, ctx),
  info: (msg: string, ctx: Record<string, unknown> = {}) => write("info", msg, ctx),
  warn: (msg: string, ctx: Record<string, unknown> = {}) => write("warn", msg, ctx),
  error: (msg: string, ctx: Record<string, unknown> = {}) => write("error", msg, ctx),
};
