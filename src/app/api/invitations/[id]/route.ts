import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSession } from "@/lib/auth";
import { isSafeUrl, sanitize, slugify } from "@/lib/format";
import { sectionAllowed } from "@/lib/entitlements";
import { ALL_SECTIONS } from "@/types";
import { getEntForInvitation, getOwnedInvitation, getSystem } from "@/server/core";

const PHOTO_KEYS = new Set(["coverPhoto", "photo", "videoPoster", "qr", "bgImage"]);
const URL_KEYS = new Set(["mapUrl", "mapEmbed", "videoUrl", "streamUrl", "musicUrl"]);

/** Sanitasi rekursif: hapus tag HTML, validasi URL & foto. Tidak ada HTML/skrip dari pengguna yang dirender. */
function clean(v: unknown, key = ""): unknown {
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => clean(x, key));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 60).map(([k, x]) => [k, clean(x, k)]));
  if (typeof v !== "string") return typeof v === "number" || typeof v === "boolean" ? v : "";
  if (PHOTO_KEYS.has(key) || key === "gallery") return v === "" || (isSafeUrl(v) && !/^data:(?!image\/(jpeg|png|webp))/.test(v) && v.length < 2_000_000) ? v : "";
  if (URL_KEYS.has(key)) return v === "" || (isSafeUrl(v) && v.length < 3_000_000) ? v : "";
  return sanitize(v, 3000);
}
// galeri: item string di dalam array "gallery" memakai key "gallery"
const body = z.object({
  title: z.string().min(1).max(100), slug: z.string().min(3).max(60), password: z.string().max(60).optional().default(""),
  publishAt: z.string().nullable().optional(), expireAt: z.string().nullable().optional(),
  data: z.record(z.string(), z.any()), design: z.record(z.string(), z.any()), sections: z.array(z.object({ key: z.string().max(40), enabled: z.boolean(), custom: z.object({ title: z.string().max(80), body: z.string().max(3000) }).optional() })).max(40),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getSession();
  if (!u || u.role !== "customer") return NextResponse.json({ ok: false, message: "Tidak diizinkan" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await getOwnedInvitation(Number(id), u.id);
  if (!inv) return NextResponse.json({ ok: false, message: "Undangan tidak ditemukan" }, { status: 404 });
  const len = Number(req.headers.get("content-length") ?? 0);
  const sys = await getSystem();
  if (len > (sys.maxUploadMB * 4 + 4) * 1024 * 1024) return NextResponse.json({ ok: false, message: "Data terlalu besar" }, { status: 413 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, message: "Data tidak valid" }, { status: 400 });
  const ent = await getEntForInvitation(inv);

  const data = clean(p.data.data) as Record<string, any>;
  if (Array.isArray(data.gallery)) data.gallery = data.gallery.filter((x: unknown) => typeof x === "string" && x).slice(0, ent.maxPhotos);
  const design = ent.advancedEditor ? (clean(p.data.design) as Record<string, any>) : inv.design;
  // custom CSS tidak didukung demi keamanan
  delete (design as Record<string, unknown>).css;
  let sections: { key: string; enabled: boolean; custom?: { title: string; body: string } }[];
  if (ent.advancedEditor) {
    sections = p.data.sections.filter((x) => ALL_SECTIONS.includes(x.key) || (/^custom:[a-z0-9]{3,12}$/.test(x.key) && sectionAllowed(x.key, ent)));
  } else {
    // Simple Editor: urutan & section tetap, hanya aktif/nonaktif
    sections = inv.sections.map((orig: { key: string; enabled: boolean }) => ({ key: orig.key, enabled: p.data.sections.find((x) => x.key === orig.key)?.enabled ?? orig.enabled }));
  }
  sections = sections.map((x) => ({ key: x.key, enabled: x.enabled, ...(x.custom ? { custom: { title: sanitize(x.custom.title, 80), body: sanitize(x.custom.body, 3000) } } : {}) }));

  let slug = slugify(p.data.slug);
  const [clash] = await db.select({ id: s.invitations.id }).from(s.invitations).where(and(eq(s.invitations.slug, slug), ne(s.invitations.id, inv.id))).limit(1);
  if (clash) return NextResponse.json({ ok: false, message: "Alamat link sudah dipakai. Pilih yang lain." }, { status: 409 });
  if (slug.length < 3) slug = inv.slug;

  const parseDate = (x?: string | null) => (x ? new Date(x) : null);
  const publishAt = ent.schedule ? parseDate(p.data.publishAt) : null;
  const expireAt = ent.schedule ? parseDate(p.data.expireAt) : inv.expireAt;
  await db.update(s.invitations).set({
    title: sanitize(p.data.title, 100), slug, data, design, sections, password: ent.passwordProtect ? sanitize(p.data.password, 60) : "",
    publishAt: publishAt && !isNaN(publishAt.getTime()) ? publishAt : null, expireAt: expireAt && !isNaN(expireAt.getTime()) ? expireAt : null, updatedAt: new Date(),
  }).where(eq(s.invitations.id, inv.id));
  return NextResponse.json({ ok: true, slug, savedAt: new Date().toISOString() });
}
