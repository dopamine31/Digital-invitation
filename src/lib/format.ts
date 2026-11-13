import { format as formatDateFns } from "date-fns";
import type { Locale } from "@/lib/types";

export function formatCurrency(amount: number, currency = "IDR", locale: Locale = "id"): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, locale: Locale = "id"): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US").format(value);
}

export function formatDate(value: Date | string, pattern = "dd MMMM yyyy", _locale: Locale = "id"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDateFns(date, pattern);
}

export function formatDateTime(value: Date | string, locale: Locale = "id"): string {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/** Link wa.me dengan pesan terisi; nomor dinormalisasi ke format 62. */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits.startsWith("62") ? digits : `62${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function absoluteUrl(path: string, base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"): string {
  return new URL(path, base).toString();
}

export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}
