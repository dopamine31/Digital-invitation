import type { Prisma } from "@/generated/prisma/client";

/** Konversi aman objek TS -> Prisma InputJsonValue (tanpa `any`). */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

/** Untuk kolom Json nullable: undefined berarti "biarkan NULL". */
export function toNullableJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function fromJson<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return value as T;
  return fallback;
}
