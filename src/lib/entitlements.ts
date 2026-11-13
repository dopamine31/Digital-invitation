import type { Tier } from "@/types";

export type Ent = {
  maxInvitations: number; maxGuests: number; maxPhotos: number;
  personalized: boolean; guestbook: boolean; gift: boolean; video: boolean; music: boolean; live: boolean;
  qr: boolean; checkin: boolean; analytics: "none" | "basic" | "advanced"; exportData: boolean;
  removeBranding: boolean; passwordProtect: boolean; schedule: boolean; customSection: boolean;
  customDomain: boolean; prioritySupport: boolean; advancedEditor: boolean;
};

export const TIER_RANK: Record<string, number> = { free: 0, basic: 1, premium: 2, exclusive: 3, custom: 4 };
export const tierOk = (templateTier: string, pkgCode: string) => (TIER_RANK[templateTier] ?? 0) <= (TIER_RANK[pkgCode] ?? 0);

export const DEFAULT_ENT: Ent = {
  maxInvitations: 1, maxGuests: 20, maxPhotos: 4, personalized: false, guestbook: false, gift: false, video: false,
  music: false, live: false, qr: false, checkin: false, analytics: "none", exportData: false, removeBranding: false,
  passwordProtect: false, schedule: false, customSection: false, customDomain: false, prioritySupport: false, advancedEditor: false,
};

/** Hitung hak akses efektif dari paket + add-on. Selalu dihitung di server. */
export function computeEnt(pkgEnt: Record<string, unknown> | undefined, addons: { code: string; entitlements: Record<string, unknown> }[] = []): Ent {
  const ent: Ent = { ...DEFAULT_ENT, ...(pkgEnt as Partial<Ent>) };
  for (const a of addons) {
    for (const [k, v] of Object.entries(a.entitlements || {})) {
      const key = k as keyof Ent;
      if (typeof v === "number" && typeof ent[key] === "number") (ent[key] as number) += v;
      else if (typeof v === "boolean" && v) (ent[key] as boolean) = true;
    }
  }
  return ent;
}

/** Section yang diizinkan sesuai paket */
export const SECTION_GATE: Record<string, keyof Ent | null> = {
  wishes: "guestbook", gift: "gift", video: "video", live: "live", gallery: null,
};
export function sectionAllowed(key: string, ent: Ent) {
  if (key.startsWith("custom:")) return ent.customSection;
  const g = SECTION_GATE[key];
  return g ? Boolean(ent[g]) : true;
}

export const FEATURE_LABELS: Record<string, string> = {
  personalized: "Undangan personal per tamu", guestbook: "Buku tamu & ucapan", gift: "Hadiah digital", video: "Video",
  music: "Musik latar", live: "Live streaming", qr: "QR Code", checkin: "Check-in event", exportData: "Export data tamu & RSVP",
  removeBranding: "Tanpa branding platform", passwordProtect: "Proteksi password", schedule: "Jadwal publikasi & kedaluwarsa",
  customSection: "Custom section", customDomain: "Custom domain", prioritySupport: "Prioritas support", advancedEditor: "Advanced Editor",
};
export type { Tier };
