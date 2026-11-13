"use server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { assertOwner, assertPerm, getSession, hashPassword, ADMIN_PERMS } from "@/lib/auth";
import { ORDER_STATUSES } from "@/components/ui";
import { sanitize, slugify } from "@/lib/format";
import { logActivity, notify, setSetting, getSite, getSystem } from "@/server/core";
import { applyPaidOrder } from "@/server/orders";
import { fail, num, ok, safe, str } from "./util";

const lines = (fd: FormData, k: string, max = 5000) => str(fd, k, max).split("\n").map((x) => sanitize(x, 200)).filter(Boolean);

/* ---------------- Pesanan & pembayaran ---------------- */
export async function setOrderStatusAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("orders");
    const id = num(fd, "orderId"), status = str(fd, "status", 40);
    if (!ORDER_STATUSES.includes(status)) return fail("Status tidak valid.");
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id)).limit(1);
    if (!o) return fail("Pesanan tidak ditemukan.");
    if (u.role === "staff" && o.assignedTo && o.assignedTo !== u.id) return fail("Pesanan ini ditugaskan kepada staff lain.");
    if (status === "refund" || status === "dibayar") await assertPerm("payments");
    if (status === "dibayar" && o.status !== "dibayar") await applyPaidOrder(o.id, u.id);
    else await db.update(s.orders).set({ status, updatedAt: new Date() }).where(eq(s.orders.id, id));
    if (status === "refund") await db.update(s.payments).set({ status: "refund" }).where(eq(s.payments.orderId, id));
    await logActivity(u.id, "Ubah status pesanan", "order", id, `${o.status} → ${status}`);
    const msgs: Record<string, string> = { dalam_pengerjaan: "Pesanan Anda sedang dikerjakan.", menunggu_revisi: "Ada revisi yang menunggu persetujuan Anda.", siap_diterbitkan: "Undangan siap diterbitkan!", selesai: "Pesanan selesai.", dibatalkan: "Pesanan dibatalkan.", refund: "Pesanan direfund." };
    if (msgs[status]) await notify(o.userId, "order", `Pesanan ${o.number}`, msgs[status], `/app/orders/${o.id}`);
    return ok("Status pesanan diperbarui.");
  });
}

export async function verifyPaymentAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("payments");
    const id = num(fd, "orderId"), approve = str(fd, "op", 10) === "approve";
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id)).limit(1);
    if (!o) return fail("Pesanan tidak ditemukan.");
    if (approve) await applyPaidOrder(id, u.id);
    else {
      await db.update(s.payments).set({ status: "ditolak", verifiedBy: u.id }).where(eq(s.payments.orderId, id));
      await db.update(s.orders).set({ status: "menunggu_pembayaran", updatedAt: new Date() }).where(eq(s.orders.id, id));
      await notify(o.userId, "payment", "Pembayaran ditolak", `Bukti pembayaran pesanan ${o.number} ditolak. Silakan unggah ulang.`, `/app/orders/${o.id}`);
      await logActivity(u.id, "Tolak pembayaran", "order", id, o.number);
    }
    return ok(approve ? "Pembayaran diverifikasi." : "Pembayaran ditolak.");
  });
}

export async function orderMetaAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("orders");
    const id = num(fd, "orderId"), op = str(fd, "op", 20);
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id)).limit(1);
    if (!o) return fail("Pesanan tidak ditemukan.");
    if (op === "note") { await db.update(s.orders).set({ note: sanitize(str(fd, "note", 2000), 2000) }).where(eq(s.orders.id, id)); await logActivity(u.id, "Catatan internal", "order", id); return ok("Catatan disimpan."); }
    if (op === "discount") {
      const d = Math.max(0, num(fd, "discount"));
      const total = Math.max(0, o.subtotal - d);
      await db.update(s.orders).set({ discount: Math.min(d, o.subtotal), total, updatedAt: new Date() }).where(eq(s.orders.id, id));
      await db.update(s.payments).set({ amount: total }).where(eq(s.payments.orderId, id));
      await logActivity(u.id, "Beri diskon", "order", id, `Rp ${d}`); return ok("Diskon diterapkan.");
    }
    if (op === "assign") { const a = num(fd, "assignedTo") || null; await db.update(s.orders).set({ assignedTo: a }).where(eq(s.orders.id, id)); await logActivity(u.id, "Tugaskan pesanan", "order", id, String(a)); return ok("Penugasan disimpan."); }
    if (op === "instruction") {
      const msg = sanitize(str(fd, "message", 1000), 1000);
      if (msg.length < 3) return fail("Pesan kosong.");
      await notify(o.userId, "order", `Instruksi untuk pesanan ${o.number}`, msg, `/app/orders/${o.id}`);
      await logActivity(u.id, "Kirim instruksi", "order", id, msg.slice(0, 80)); return ok("Instruksi dikirim ke customer.");
    }
    return fail("Operasi tidak dikenal.");
  });
}

/* ---------------- Customer ---------------- */
export async function customerAdminAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("customers");
    const id = num(fd, "userId"), op = str(fd, "op", 20);
    const [c] = await db.select().from(s.users).where(and(eq(s.users.id, id), eq(s.users.role, "customer"))).limit(1);
    if (!c) return fail("Customer tidak ditemukan.");
    if (op === "note") await db.update(s.users).set({ note: sanitize(str(fd, "note", 1000), 1000) }).where(eq(s.users.id, id));
    else if (u.role !== "owner") return fail("Hanya Owner yang dapat memblokir akun.");
    else await db.update(s.users).set({ status: op === "block" ? "blocked" : "active" }).where(eq(s.users.id, id));
    await logActivity(u.id, `Customer ${op}`, "user", id, c.email);
    return ok("Perubahan disimpan.");
  });
}

/* ---------------- Template & kategori ---------------- */
const pick = (fd: FormData, k: string, allowed: string[], def: string) => (allowed.includes(str(fd, k, 30)) ? str(fd, k, 30) : def);
export async function saveTemplateAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("templates");
    const id = num(fd, "id");
    const name = sanitize(str(fd, "name", 80), 80);
    if (name.length < 2) return fail("Nama template wajib diisi.");
    const slug = slugify(str(fd, "slug", 80) || name);
    const hex = (k: string, d: string) => (/^#[0-9a-fA-F]{6}$/.test(str(fd, k, 7)) ? str(fd, k, 7) : d);
    const config = {
      pal: { bg: hex("pal_bg", "#ffffff"), surface: hex("pal_surface", "#ffffff"), text: hex("pal_text", "#111111"), muted: hex("pal_muted", "#777777"), accent: hex("pal_accent", "#b08d57"), accent2: hex("pal_accent2", "#d9c7a3") },
      head: sanitize(str(fd, "head", 40), 40) || "Playfair Display", body: sanitize(str(fd, "body", 40), 40) || "Lora", script: sanitize(str(fd, "script", 40), 40) || "Great Vibes",
      cover: pick(fd, "cover", ["center", "split", "frame", "arch", "stack", "type", "full", "circle"], "center"),
      orn: pick(fd, "orn", ["floral", "leaf", "geo", "islamic", "batik", "wave", "marble", "line", "dots", "gold", "stars", "none"], "line"),
      gal: pick(fd, "gal", ["grid", "masonry", "polaroid", "slider", "film", "mosaic"], "grid"),
      anim: pick(fd, "anim", ["fade", "rise", "zoom", "blur", "slide", "flip"], "fade"),
      btn: pick(fd, "btn", ["pill", "square", "outline", "underline", "soft"], "pill"),
      ev: pick(fd, "ev", ["cards", "timeline", "split", "ticket"], "cards"),
      dark: fd.get("dark") === "on", rad: Math.min(32, Math.max(0, num(fd, "rad", 12))),
    };
    const values = {
      name, slug, categoryId: num(fd, "categoryId") || null, style: sanitize(str(fd, "style", 40), 40), description: sanitize(str(fd, "description", 400), 400),
      price: Math.max(0, num(fd, "price")), tier: pick(fd, "tier", ["free", "basic", "premium", "exclusive"], "free"), featured: fd.get("featured") === "on", isNew: fd.get("isNew") === "on",
      popularity: Math.max(0, num(fd, "popularity")), status: pick(fd, "status", ["published", "draft"], "published"), features: lines(fd, "features"),
      tags: str(fd, "tags", 300).split(",").map((x) => sanitize(x, 30)).filter(Boolean), sections: fd.getAll("sections").map(String), config: config as unknown as Record<string, unknown>,
    };
    const [clash] = await db.select({ id: s.templates.id }).from(s.templates).where(eq(s.templates.slug, slug)).limit(1);
    if (clash && clash.id !== id) return fail("Slug sudah dipakai template lain.");
    if (id) await db.update(s.templates).set(values).where(eq(s.templates.id, id));
    else await db.insert(s.templates).values(values);
    await logActivity(u.id, id ? "Edit template" : "Tambah template", "template", id || undefined, name);
    return ok("Template disimpan.", "/admin/templates");
  });
}
export async function templateOpAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("templates");
    const id = num(fd, "id"), op = str(fd, "op", 20);
    const [t] = await db.select().from(s.templates).where(eq(s.templates.id, id)).limit(1);
    if (!t) return fail("Template tidak ditemukan.");
    if (op === "duplicate") {
      const { id: _id, createdAt: _c, ...rest } = t; void _id; void _c;
      await db.insert(s.templates).values({ ...rest, name: `${t.name} (Salinan)`, slug: `${t.slug}-copy-${Math.random().toString(36).slice(2, 5)}`, status: "draft", popularity: 0 });
    } else if (op === "delete") {
      const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(s.invitations).where(eq(s.invitations.templateId, id));
      if (c > 0) { await db.update(s.templates).set({ status: "draft" }).where(eq(s.templates.id, id)); await logActivity(u.id, "Sembunyikan template (dipakai)", "template", id, t.name); return ok(`Template dipakai ${c} undangan, jadi hanya disembunyikan (draft).`); }
      await db.delete(s.templates).where(eq(s.templates.id, id));
    }
    await logActivity(u.id, `Template ${op}`, "template", id, t.name);
    return ok(op === "duplicate" ? "Template diduplikasi sebagai draft." : "Template dihapus.");
  });
}
export async function saveCategoryAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("templates");
    const id = num(fd, "id"), name = sanitize(str(fd, "name", 60), 60);
    if (name.length < 2) return fail("Nama kategori wajib diisi.");
    const v = { name, slug: slugify(str(fd, "slug", 60) || name), icon: str(fd, "icon", 4) || "✨", sortOrder: num(fd, "sortOrder") };
    if (str(fd, "op", 10) === "delete") {
      const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(s.templates).where(eq(s.templates.categoryId, id));
      if (c > 0) return fail(`Kategori dipakai ${c} template. Pindahkan template terlebih dahulu.`);
      await db.delete(s.categories).where(eq(s.categories.id, id)); return ok("Kategori dihapus.");
    }
    if (id) await db.update(s.categories).set(v).where(eq(s.categories.id, id)); else await db.insert(s.categories).values(v);
    await logActivity(u.id, "Simpan kategori", "category", id || undefined, name);
    return ok("Kategori disimpan.");
  });
}

/* ---------------- Paket & voucher ---------------- */
export async function savePackageAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("packages");
    const id = num(fd, "id");
    let ent: Record<string, unknown> = {};
    try { ent = JSON.parse(str(fd, "entitlements", 4000) || "{}"); } catch { return fail("Entitlements bukan JSON yang valid."); }
    const promo = str(fd, "promoPrice", 12);
    const v = {
      name: sanitize(str(fd, "name", 60), 60), description: sanitize(str(fd, "description", 300), 300), price: Math.max(0, num(fd, "price")), promoPrice: promo === "" ? null : Math.max(0, Number(promo) || 0),
      durationDays: Math.max(1, num(fd, "durationDays", 30)), features: lines(fd, "features"), entitlements: ent, highlight: fd.get("highlight") === "on", active: fd.get("active") === "on", sortOrder: num(fd, "sortOrder"),
    };
    if (v.name.length < 2) return fail("Nama paket wajib diisi.");
    if (id) await db.update(s.packages).set(v).where(eq(s.packages.id, id));
    else {
      const code = slugify(str(fd, "code", 30) || v.name).slice(0, 30);
      const [x] = await db.select().from(s.packages).where(eq(s.packages.code, code)).limit(1);
      if (x) return fail("Kode paket sudah ada.");
      await db.insert(s.packages).values({ ...v, code, isAddon: fd.get("isAddon") === "on" });
    }
    await logActivity(u.id, "Simpan paket", "package", id || undefined, v.name);
    return ok("Paket disimpan.");
  });
}
export async function saveVoucherAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("vouchers");
    const id = num(fd, "id"), op = str(fd, "op", 10);
    if (op === "delete") { await db.delete(s.vouchers).where(eq(s.vouchers.id, id)); return ok("Voucher dihapus."); }
    const code = str(fd, "code", 30).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (code.length < 3) return fail("Kode voucher minimal 3 karakter.");
    const date = (k: string) => (str(fd, k, 20) ? new Date(str(fd, k, 20)) : null);
    const v = { code, type: str(fd, "type", 10) === "fixed" ? "fixed" : "percent", value: Math.max(1, num(fd, "value")), minTotal: Math.max(0, num(fd, "minTotal")), quota: Math.max(1, num(fd, "quota", 100)),
      packageCode: str(fd, "packageCode", 30) || null, userId: num(fd, "userId") || null, startsAt: date("startsAt"), endsAt: date("endsAt"), active: fd.get("active") === "on" };
    if (v.type === "percent" && v.value > 100) return fail("Diskon persen maksimal 100.");
    if (id) await db.update(s.vouchers).set(v).where(eq(s.vouchers.id, id));
    else { const [x] = await db.select().from(s.vouchers).where(eq(s.vouchers.code, code)).limit(1); if (x) return fail("Kode sudah ada."); await db.insert(s.vouchers).values(v); }
    await logActivity(u.id, "Simpan voucher", "voucher", id || undefined, code);
    return ok("Voucher disimpan.");
  });
}

/* ---------------- Konten & pengaturan ---------------- */
export async function saveContentAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("content");
    const [cur] = await db.select().from(s.settings).where(eq(s.settings.key, "content")).limit(1);
    const old = (cur?.value ?? {}) as Record<string, unknown>;
    const faq = lines(fd, "faq").map((l) => { const [q, ...a] = l.split("|"); return { q: q.trim(), a: a.join("|").trim() }; }).filter((f) => f.q && f.a);
    const testimonials = lines(fd, "testimonials").map((l) => { const [name, role, ...t] = l.split("|"); return { name: (name ?? "").trim(), role: (role ?? "").trim(), text: t.join("|").trim() }; }).filter((t) => t.name && t.text);
    await setSetting("content", { ...old, heroTitle: sanitize(str(fd, "heroTitle", 200), 200), heroSubtitle: sanitize(str(fd, "heroSubtitle", 400), 400), banner: sanitize(str(fd, "banner", 200), 200), faq, testimonials,
      pages: { terms: sanitize(str(fd, "terms", 6000), 6000), privacy: sanitize(str(fd, "privacy", 6000), 6000), help: sanitize(str(fd, "help", 1000), 1000) } });
    await logActivity(u.id, "Ubah konten", "settings", undefined, "content");
    return ok("Konten disimpan.");
  });
}
export async function saveSiteAction(fd: FormData) {
  return safe(async () => {
    const u = await assertOwner();
    const cur = await getSite();
    const next: Record<string, unknown> = { ...cur };
    for (const k of ["name", "tagline", "whatsapp", "email", "address", "instagram", "facebook", "tiktok", "youtube", "domain", "brandColor", "font", "seoTitle", "seoDesc", "ogImage", "pwaName", "pwaShort", "logo", "favicon"]) if (fd.has(k)) next[k] = sanitize(str(fd, k, 300), 300);
    await setSetting("site", next);
    await logActivity(u.id, "Ubah pengaturan website", "settings", undefined, "site");
    return ok("Pengaturan website disimpan.");
  });
}
export async function saveSystemAction(fd: FormData) {
  return safe(async () => {
    const u = await assertOwner();
    const cur = await getSystem();
    const next: Record<string, unknown> = { ...cur };
    for (const k of ["backup", "emailProvider", "storage", "paymentProvider", "bankName", "bankNumber", "bankHolder"]) if (fd.has(k)) next[k] = sanitize(str(fd, k, 100), 100);
    for (const k of ["maxUploadMB", "maxPhotos", "sessionDays"]) if (fd.has(k)) next[k] = Math.min(50, Math.max(1, num(fd, k, 5)));
    for (const k of ["maintenance", "twoFactor", "notifyEmail", "notifyPush"]) if (fd.has(`${k}__present`)) next[k] = fd.get(k) === "on";
    await setSetting("system", next);
    await logActivity(u.id, "Ubah pengaturan sistem", "settings", undefined, Object.keys(next).filter((k) => fd.has(k)).join(","));
    return ok("Pengaturan sistem disimpan.");
  });
}

/* ---------------- Staff ---------------- */
export async function saveStaffAction(fd: FormData) {
  return safe(async () => {
    const u = await assertOwner();
    const id = num(fd, "id"), op = str(fd, "op", 10);
    if (op === "toggle") {
      const [t] = await db.select().from(s.users).where(and(eq(s.users.id, id), eq(s.users.role, "staff"))).limit(1);
      if (!t) return fail("Staff tidak ditemukan.");
      await db.update(s.users).set({ status: t.status === "active" ? "blocked" : "active" }).where(eq(s.users.id, id));
      await logActivity(u.id, "Toggle staff", "user", id, t.email); return ok("Status staff diubah.");
    }
    const perms = fd.getAll("perm").map(String).filter((p) => (ADMIN_PERMS as readonly string[]).includes(p));
    const name = sanitize(str(fd, "name", 80), 80), email = str(fd, "email", 120).toLowerCase();
    if (id) {
      await db.update(s.users).set({ name, phone: str(fd, "phone", 20), permissions: perms }).where(and(eq(s.users.id, id), eq(s.users.role, "staff")));
    } else {
      const pw = String(fd.get("password") ?? "");
      if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || pw.length < 8) return fail("Nama, email valid, dan password minimal 8 karakter wajib diisi.");
      const [x] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      if (x) return fail("Email sudah terdaftar.");
      await db.insert(s.users).values({ name, email, phone: str(fd, "phone", 20), passwordHash: hashPassword(pw), role: "staff", permissions: perms });
    }
    await logActivity(u.id, id ? "Edit staff" : "Tambah staff", "user", id || undefined, email || name);
    return ok("Staff disimpan.");
  });
}

/* ---------------- Support ---------------- */
export async function replyTicketStaffAction(fd: FormData) {
  return safe(async () => {
    const u = await assertPerm("support");
    const [t] = await db.select().from(s.tickets).where(eq(s.tickets.id, num(fd, "ticketId"))).limit(1);
    if (!t) return fail("Tiket tidak ditemukan.");
    const body = sanitize(str(fd, "body", 2000), 2000);
    if (body.length < 2) return fail("Balasan kosong.");
    const status = ["open", "dibalas", "selesai"].includes(str(fd, "status", 10)) ? str(fd, "status", 10) : "dibalas";
    await db.insert(s.ticketMessages).values({ ticketId: t.id, userId: u.id, isStaff: true, body });
    await db.update(s.tickets).set({ status, assignedTo: t.assignedTo ?? u.id, updatedAt: new Date() }).where(eq(s.tickets.id, t.id));
    await notify(t.userId, "support", "Tiket dibalas", t.subject, `/app/support/${t.id}`);
    await logActivity(u.id, "Balas tiket", "ticket", t.id, t.subject);
    return ok("Balasan terkirim.");
  });
}
export async function markAdminNotificationsAction() {
  const u = await getSession();
  if (u) await db.update(s.notifications).set({ read: true }).where(eq(s.notifications.userId, u.id));
  return ok("Ditandai dibaca.");
}
