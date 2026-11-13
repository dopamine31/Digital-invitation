import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(10),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET minimal 32 karakter"),
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY minimal 32 karakter"),
  CSRF_SALT: z.string().min(8).default("rasa-csrf"),
  REDIS_URL: z.string().default(""),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_PUBLIC_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("rasa-media"),
  S3_ACCESS_KEY: z.string().default("rasa"),
  S3_SECRET_KEY: z.string().default("rasa"),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3000/api/auth/google/callback"),
  WHATSAPP_ADAPTER: z.enum(["mock", "fonnte", "watzap", "meta"]).default("mock"),
  WHATSAPP_API_KEY: z.string().default(""),
  WHATSAPP_API_URL: z.string().default(""),
  EMAIL_ADAPTER: z.enum(["mock", "smtp"]).default("mock"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  EMAIL_FROM: z.string().default("Rasa Undangan <no-reply@rasa.id>"),
  PAYMENT_ADAPTER: z.enum(["mock", "midtrans", "xendit"]).default("mock"),
  MIDTRANS_SERVER_KEY: z.string().default(""),
  MIDTRANS_CLIENT_KEY: z.string().default(""),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).default("false"),
  XENDIT_API_KEY: z.string().default(""),
  XENDIT_WEBHOOK_TOKEN: z.string().default(""),
  DEFAULT_LOCALE: z.enum(["id", "en"]).default("id"),
  DEFAULT_CURRENCY: z.string().default("IDR"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Jakarta"),
  MAINTENANCE_MODE: z.enum(["true", "false"]).default("false"),
  SUPER_ADMIN_EMAIL: z.string().email().default("superadmin@rasa.id"),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default("SuperAdmin!234"),
  SEED_DEMO_DATA: z.enum(["true", "false"]).default("true"),
  BLAST_THROTTLE_PER_MINUTE: z.coerce.number().int().positive().default(60),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Validasi env di server. Dipanggil lazily agar build tetap bisa mengoleksi metadata. */
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Konfigurasi environment tidak valid -> ${details}. Salin .env.example ke .env.`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Variabel yang AMAN dibaca browser. Jangan pernah menaruh secret di sini. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "id",
} as const;
