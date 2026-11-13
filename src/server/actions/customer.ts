"use server";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { assertCustomer, hashPassword, verifyPassword } from "@/lib/auth";
import { computeTotals, validateVoucher, voucherDiscount } from "@/lib/pricing";
import { tierOk } from "@/lib/entitlements";
import { parseCSV, randomCode, sanitize, slugify } from "@/lib/format";
import { defaultInvitationData, defaultSections } from "@/templates/defaults";
import { getEntForInvitation, getOwnedInvitation, getPackages, getSystem, logActivity, notify } from "@/server/core";
import { applyPaidOrder, bumpVoucher, genOrderNumber } from "@/server/orders";
import { getPaymentAdapter } from "@/adapters/payment";
import { fail, num, ok, safe, str } from "./util";

/* ---------------- Favorit ---------------- */
export async function toggleFavorite(templateId: number) {
  return safe(async () => {
    const u = await assertCustomer();
    const [ex] = await db.select().from(s.favorites).where(and(eq(s.favorites.userId, u.id), eq(s.favorites.templateId, templateId)));
    if (ex) { await db.delete(s.favorites).where(and(eq(s.favorites.userId, u.id), eq(s.favorites.templateId, templateId))); return ok("Dihapus dari favorit."); }
    await db.insert(s.favorites).values({ userId: u.id, templateId });
    return ok("Ditambahkan ke favorit.");
  });
}

/* ---------------- Order ---------------- */
async function uniqueSlug(base: string) {
  for (let i = 0; i < 8; i++) {
    const slug = i === 0 ? base : `${base}-${randomCode(4)}`;
    const [x] = await db.select({ id: s.invitations.id }).from(s.invitations).where(eq(s.invitations.slug, slug)).limit(1);
    if (!x) return slug;
  }
  return `${base}-${randomCode(8)}`;
}

export async function createOrderAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const [tpl] = await db.select().from(s.templates).where(eq(s.templates.slug, str(fd, "template", 80))).limit(1);
    if (!tpl) return fail("Template tidak ditemukan.");
    const pkgs = await getPackages();
    const pkg = pkgs.find((p) => p.code === str(fd, "pkg", 30) && !p.isAddon);
    if (!pkg) return fail("Pilih paket terlebih dahulu.");
    if (!tierOk(tpl.tier, pkg.code)) return fail(`Template ${tpl.name} membutuhkan paket ${tpl.tier} atau lebih tinggi.`);
    const addonCodes = fd.getAll("addons").map(String);
    const addons = pkgs.filter((p) => p.isAddon && addonCodes.includes(p.code));

    let invitationId: number | null = num(fd, "invitation") || null;
    if (invitationId) {
      const inv = await getOwnedInvitation(invitationId, u.id);
      if (!inv) return fail("Undangan tidak ditemukan.");
    } else if (pkg.code === "free") {
      const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(s.invitations).where(and(eq(s.invitations.userId, u.id), eq(s.invitations.packageCode, "free"), isNull(s.invitations.deletedAt)));
      if (c >= 1) return fail("Paket Free dibatasi 1 undangan. Pilih paket berbayar atau hapus undangan Free Anda.");
    }

    // hitung harga di SERVER (tidak mempercayai harga dari klien)
    const packagePrice = pkg.promoPrice ?? pkg.price;
    const base = computeTotals({ packagePrice, templatePrice: tpl.price, addonPrices: addons.map((a) => a.price) });
    let discount = 0, voucherCode: string | null = null;
    const vcode = str(fd, "voucher", 30).toUpperCase();
    if (vcode) {
      const [v] = await db.select().from(s.vouchers).where(eq(s.vouchers.code, vcode)).limit(1);
      const chk = validateVoucher(v, base.subtotal, pkg.code, u.id);
      if (!chk.ok) return fail(chk.message);
      discount = voucherDiscount(v, base.subtotal); voucherCode = v.code;
    }
    const totals = computeTotals({ packagePrice, templatePrice: tpl.price, addonPrices: addons.map((a) => a.price), discount });

    if (!invitationId) {
      const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, tpl.categoryId ?? 0)).limit(1);
      const data = defaultInvitationData(cat?.slug ?? "wedding");
      const [inv] = await db.insert(s.invitations).values({
        userId: u.id, templateId: tpl.id, slug: await uniqueSlug(slugify(`${u.name.split(" ")[0]}-${data.host2.name ? data.host2.name.toLowerCase() : "acara"}`)),
        title: data.host2.name ? `${data.host1.name} & ${data.host2.name}` : data.host1.name, data, sections: defaultSections(), packageCode: "free", settings: { moderate: false, rsvpEnabled: true },
      }).returning();
      invitationId = inv.id;
    }
    const [order] = await db.insert(s.orders).values({
      number: genOrderNumber(), userId: u.id, templateId: tpl.id, invitationId, packageCode: pkg.code, addons: addons.map((a) => a.code),
      subtotal: totals.subtotal, discount: totals.discount, total: totals.total, voucherCode, isCustomDesign: pkg.code === "custom", customerNote: str(fd, "note", 500),
    }).returning();
    await db.insert(s.payments).values({ orderId: order.id, reference: `PAY-${order.number.slice(4)}`, method: "transfer", amount: order.total, status: "pending", provider: "manual" });
    await bumpVoucher(voucherCode);
    await notify(u.id, "order", "Pesanan dibuat", `Pesanan ${order.number} menunggu pembayaran.`, `/app/orders/${order.id}`);
    await logActivity(u.id, "Buat pesanan", "order", order.id, order.number);
    if (order.total === 0) {
      await applyPaidOrder(order.id, null);
      return ok("Undangan dibuat! Silakan isi data acara.", `/app/invitations/${invitationId}/edit`);
    }
    return ok("Pesanan dibuat. Lanjutkan ke pembayaran.", `/app/orders/${order.id}`);
  });
}

async function ownedOrder(id: number, userId: number) {
  const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, id), eq(s.orders.userId, userId))).limit(1);
  return o;
}

export async function simulatePayAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const o = await ownedOrder(num(fd, "orderId"), u.id);
    if (!o) return fail("Pesanan tidak ditemukan.");
    if (o.status !== "menunggu_pembayaran" && o.status !== "menunggu_verifikasi") return fail("Pesanan tidak dalam status menunggu pembayaran.");
    const sys = await getSystem();
    const adapter = getPaymentAdapter(sys.paymentProvider);
    if (adapter.name !== "demo") return fail(`${adapter.name} belum aktif. Gunakan transfer manual.`);
    const r = await adapter.createCharge({ orderNumber: o.number, amount: o.total, customerEmail: u.email });
    await db.update(s.payments).set({ method: "demo", provider: "demo", reference: r.reference }).where(eq(s.payments.orderId, o.id));
    await applyPaidOrder(o.id, null);
    return ok("Simulasi pembayaran berhasil (mode demo).");
  });
}

export async function uploadProofAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const o = await ownedOrder(num(fd, "orderId"), u.id);
    if (!o) return fail("Pesanan tidak ditemukan.");
    if (o.status !== "menunggu_pembayaran" && o.status !== "menunggu_verifikasi") return fail("Pesanan ini tidak menerima bukti pembayaran.");
    const proof = String(fd.get("proof") ?? "");
    const sys = await getSystem();
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(proof)) return fail("Format file tidak valid. Gunakan JPG, PNG, atau WebP.");
    if (proof.length > sys.maxUploadMB * 1.4 * 1024 * 1024) return fail(`Ukuran file maksimal ${sys.maxUploadMB} MB.`);
    await db.update(s.payments).set({ proof, status: "menunggu_verifikasi", method: str(fd, "method", 20) || "transfer" }).where(eq(s.payments.orderId, o.id));
    await db.update(s.orders).set({ status: "menunggu_verifikasi", updatedAt: new Date() }).where(eq(s.orders.id, o.id));
    const staff = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "owner"));
    for (const st of staff) await notify(st.id, "order", "Bukti pembayaran masuk", `Pesanan ${o.number} menunggu verifikasi.`, `/admin/orders/${o.id}`);
    await logActivity(u.id, "Upload bukti bayar", "order", o.id, o.number);
    return ok("Bukti pembayaran terkirim. Admin akan memverifikasi.");
  });
}

export async function cancelOrderAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const o = await ownedOrder(num(fd, "orderId"), u.id);
    if (!o || o.status !== "menunggu_pembayaran") return fail("Pesanan tidak dapat dibatalkan.");
    await db.update(s.orders).set({ status: "dibatalkan", updatedAt: new Date() }).where(eq(s.orders.id, o.id));
    await db.update(s.payments).set({ status: "ditolak" }).where(eq(s.payments.orderId, o.id));
    await logActivity(u.id, "Batalkan pesanan", "order", o.id, o.number);
    return ok("Pesanan dibatalkan.", "/app/orders");
  });
}

/* ---------------- Undangan ---------------- */
async function mine(fd: FormData) {
  const u = await assertCustomer();
  const inv = await getOwnedInvitation(num(fd, "id"), u.id);
  if (!inv) throw new Error("Akses ditolak");
  return { u, inv };
}

export async function duplicateInvitationAction(fd: FormData) {
  return safe(async () => {
    const { u, inv } = await mine(fd);
    const all = await db.select().from(s.invitations).where(and(eq(s.invitations.userId, u.id), isNull(s.invitations.deletedAt)));
    let maxAllowed = 1;
    for (const i of all) maxAllowed = Math.max(maxAllowed, (await getEntForInvitation(i)).maxInvitations);
    if (all.length >= maxAllowed) return fail(`Batas ${maxAllowed} undangan pada paket Anda tercapai. Upgrade paket untuk menambah.`);
    const [copy] = await db.insert(s.invitations).values({
      userId: u.id, templateId: inv.templateId, slug: await uniqueSlug(`${inv.slug}-salinan`), title: `${inv.title} (Salinan)`, data: inv.data, design: inv.design,
      sections: inv.sections, settings: inv.settings, packageCode: "free", status: "draft",
    }).returning();
    await logActivity(u.id, "Duplikasi undangan", "invitation", copy.id, inv.slug);
    return ok("Undangan diduplikasi sebagai draft.", `/app/invitations/${copy.id}/edit`);
  });
}

export async function deleteInvitationAction(fd: FormData) {
  return safe(async () => {
    const { u, inv } = await mine(fd);
    await db.update(s.invitations).set({ deletedAt: new Date(), status: "archived", slug: `${inv.slug}-del-${inv.id}` }).where(eq(s.invitations.id, inv.id));
    await logActivity(u.id, "Hapus undangan", "invitation", inv.id, inv.slug);
    return ok("Undangan dihapus.", "/app/invitations");
  });
}

export async function setInvitationStatusAction(fd: FormData) {
  return safe(async () => {
    const { u, inv } = await mine(fd);
    const status = str(fd, "status", 20);
    if (!["published", "draft", "archived"].includes(status)) return fail("Status tidak valid.");
    if (status === "published") {
      const [tpl] = await db.select().from(s.templates).where(eq(s.templates.id, inv.templateId)).limit(1);
      if (!tierOk(tpl.tier, inv.packageCode)) return fail(`Template ${tpl.name} membutuhkan paket ${tpl.tier}. Selesaikan pembayaran / upgrade paket untuk menerbitkan.`);
      const d = inv.data as { host1?: { name?: string } };
      if (!d.host1?.name) return fail("Lengkapi nama pada data undangan terlebih dahulu.");
    }
    await db.update(s.invitations).set({ status, updatedAt: new Date() }).where(eq(s.invitations.id, inv.id));
    if (status === "published") {
      await db.update(s.orders).set({ status: "selesai", updatedAt: new Date() }).where(and(eq(s.orders.invitationId, inv.id), inArray(s.orders.status, ["dibayar", "siap_diterbitkan"])));
      await notify(u.id, "invitation", "Undangan diterbitkan", `Undangan "${inv.title}" kini dapat dibuka tamu.`, `/i/${inv.slug}`);
    }
    await logActivity(u.id, `Undangan → ${status}`, "invitation", inv.id, inv.slug);
    return ok(status === "published" ? "Undangan diterbitkan!" : status === "draft" ? "Undangan ditarik (unpublish)." : "Undangan diarsipkan.");
  });
}

export async function changeTemplateAction(fd: FormData) {
  return safe(async () => {
    const { u, inv } = await mine(fd);
    const [tpl] = await db.select().from(s.templates).where(eq(s.templates.slug, str(fd, "template", 80))).limit(1);
    if (!tpl) return fail("Template tidak ditemukan.");
    if (!tierOk(tpl.tier, inv.packageCode)) return fail(`Template ${tpl.name} membutuhkan paket ${tpl.tier}. Upgrade paket terlebih dahulu.`);
    await db.update(s.invitations).set({ templateId: tpl.id, design: {}, updatedAt: new Date() }).where(eq(s.invitations.id, inv.id));
    await logActivity(u.id, "Ganti template", "invitation", inv.id, tpl.slug);
    return ok(`Template diganti ke ${tpl.name}. Data Anda tetap aman.`);
  });
}

export async function trackShareAction(guestId: number) {
  return safe(async () => {
    const u = await assertCustomer();
    const [g] = await db.select({ g: s.guests, inv: s.invitations }).from(s.guests).innerJoin(s.invitations, eq(s.guests.invitationId, s.invitations.id)).where(and(eq(s.guests.id, guestId), eq(s.invitations.userId, u.id))).limit(1);
    if (!g) return fail("Tamu tidak ditemukan.");
    await db.update(s.guests).set({ shared: true, sharedAt: new Date() }).where(eq(s.guests.id, guestId));
    await db.update(s.invitations).set({ shares: sql`${s.invitations.shares} + 1` }).where(eq(s.invitations.id, g.inv.id));
    return ok("Ditandai sudah dibagikan.");
  });
}

/* ---------------- Tamu ---------------- */
async function guestCtx(fd: FormData, needPersonal = true) {
  const { u, inv } = await mine(fd);
  const ent = await getEntForInvitation(inv);
  if (needPersonal && !ent.personalized) throw new Error("Silakan upgrade ke paket Premium untuk fitur undangan personal.");
  return { u, inv, ent };
}
async function guestCount(invId: number) {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(s.guests).where(eq(s.guests.invitationId, invId));
  return c;
}

export async function addGuestAction(fd: FormData) {
  return safe(async () => {
    const { inv, ent } = await guestCtx(fd);
    const name = sanitize(str(fd, "name", 80), 80);
    if (name.length < 2) return fail("Nama tamu wajib diisi.");
    if ((await guestCount(inv.id)) >= ent.maxGuests) return fail(`Kuota tamu paket Anda (${ent.maxGuests}) sudah penuh.`);
    await db.insert(s.guests).values({ invitationId: inv.id, name, phone: sanitize(str(fd, "phone", 20), 20), category: sanitize(str(fd, "category", 40), 40) || "Umum", groupName: sanitize(str(fd, "group", 60), 60), code: randomCode(8) });
    return ok("Tamu ditambahkan.");
  });
}

export async function updateGuestAction(fd: FormData) {
  return safe(async () => {
    const { inv } = await guestCtx(fd);
    const gid = num(fd, "guestId");
    await db.update(s.guests).set({ name: sanitize(str(fd, "name", 80), 80), phone: sanitize(str(fd, "phone", 20), 20), category: sanitize(str(fd, "category", 40), 40) || "Umum", groupName: sanitize(str(fd, "group", 60), 60) })
      .where(and(eq(s.guests.id, gid), eq(s.guests.invitationId, inv.id)));
    return ok("Data tamu diperbarui.");
  });
}

export async function deleteGuestAction(fd: FormData) {
  return safe(async () => {
    const { inv } = await guestCtx(fd, false);
    await db.delete(s.guests).where(and(eq(s.guests.id, num(fd, "guestId")), eq(s.guests.invitationId, inv.id)));
    return ok("Tamu dihapus.");
  });
}

export async function importGuestsAction(fd: FormData) {
  return safe(async () => {
    const { inv, ent } = await guestCtx(fd);
    const rows = parseCSV(String(fd.get("csv") ?? "").slice(0, 400_000));
    if (!rows.length) return fail("File CSV kosong.");
    const hasHeader = /nama|name/i.test(rows[0][0] ?? "");
    const data = (hasHeader ? rows.slice(1) : rows).filter((r) => (r[0] ?? "").trim().length >= 2);
    const room = ent.maxGuests - (await guestCount(inv.id));
    if (room <= 0) return fail("Kuota tamu penuh.");
    const take = data.slice(0, room);
    if (!take.length) return fail("Tidak ada baris valid. Format: nama,telepon,kategori,kelompok");
    await db.insert(s.guests).values(take.map((r) => ({ invitationId: inv.id, name: sanitize(r[0], 80), phone: sanitize(r[1] ?? "", 20), category: sanitize(r[2] ?? "", 40) || "Umum", groupName: sanitize(r[3] ?? "", 60), code: randomCode(8) })));
    return ok(`${take.length} tamu diimpor${take.length < data.length ? ` (${data.length - take.length} dilewati karena kuota)` : ""}.`);
  });
}

export async function checkInAction(fd: FormData) {
  return safe(async () => {
    const { u, inv, ent } = await guestCtx(fd, false);
    if (!ent.checkin) return fail("Check-in tersedia pada paket Premium ke atas.");
    let code = str(fd, "code", 400);
    const m = code.match(/[?&]g=([a-z0-9]+)/i);
    if (m) code = m[1];
    const [g] = await db.select().from(s.guests).where(and(eq(s.guests.code, code.toLowerCase()), eq(s.guests.invitationId, inv.id))).limit(1);
    if (!g) return fail("QR / kode tidak dikenali untuk undangan ini.");
    if (g.checkedInAt) return fail(`${g.name} sudah check-in pada ${g.checkedInAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}.`);
    await db.update(s.guests).set({ checkedInAt: new Date(), checkedInBy: u.name, attendance: "hadir" }).where(eq(s.guests.id, g.id));
    return ok(`✓ ${g.name} berhasil check-in.`);
  });
}

/* ---------------- RSVP / Ucapan ---------------- */
export async function moderateWishAction(fd: FormData) {
  return safe(async () => {
    const { inv } = await mine(fd);
    const id = num(fd, "wishId");
    if (str(fd, "op", 10) === "delete") await db.delete(s.wishes).where(and(eq(s.wishes.id, id), eq(s.wishes.invitationId, inv.id)));
    else await db.update(s.wishes).set({ approved: str(fd, "op", 10) === "approve" }).where(and(eq(s.wishes.id, id), eq(s.wishes.invitationId, inv.id)));
    return ok("Ucapan diperbarui.");
  });
}
export async function updateInvitationSettingsAction(fd: FormData) {
  return safe(async () => {
    const { inv } = await mine(fd);
    await db.update(s.invitations).set({ settings: { ...inv.settings, moderate: fd.get("moderate") === "on", rsvpEnabled: fd.get("rsvpEnabled") === "on" } }).where(eq(s.invitations.id, inv.id));
    return ok("Pengaturan disimpan.");
  });
}

/* ---------------- Akun & notifikasi ---------------- */
export async function updateProfileAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const name = sanitize(str(fd, "name", 80), 80);
    if (name.length < 2) return fail("Nama minimal 2 karakter.");
    const avatar = String(fd.get("avatar") ?? "");
    const patch: Partial<typeof s.users.$inferInsert> = { name, phone: sanitize(str(fd, "phone", 20), 20) };
    if (avatar) { if (!/^data:image\/(jpeg|png|webp);base64,/.test(avatar) || avatar.length > 400_000) return fail("Foto profil tidak valid / terlalu besar."); patch.avatar = avatar; }
    await db.update(s.users).set(patch).where(eq(s.users.id, u.id));
    return ok("Profil diperbarui.");
  });
}
export async function changePasswordAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    if (!verifyPassword(String(fd.get("current") ?? ""), u.passwordHash)) return fail("Kata sandi saat ini salah.");
    const np = String(fd.get("next") ?? "");
    if (np.length < 8) return fail("Kata sandi baru minimal 8 karakter.");
    await db.update(s.users).set({ passwordHash: hashPassword(np) }).where(eq(s.users.id, u.id));
    await logActivity(u.id, "Ubah password", "auth", u.id);
    return ok("Kata sandi diubah.");
  });
}
export async function markNotificationsReadAction(fd: FormData) {
  return safe(async () => {
    const u = await (await import("@/lib/auth")).getSession();
    if (!u) return fail("Silakan masuk.");
    const id = num(fd, "id");
    await db.update(s.notifications).set({ read: true }).where(id ? and(eq(s.notifications.userId, u.id), eq(s.notifications.id, id)) : eq(s.notifications.userId, u.id));
    return ok("Notifikasi ditandai dibaca.");
  });
}

/* ---------------- Bantuan (dipakai customer & staff) ---------------- */
export async function createTicketAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const subject = sanitize(str(fd, "subject", 120), 120), body = sanitize(str(fd, "body", 2000), 2000);
    if (subject.length < 4 || body.length < 5) return fail("Subjek dan pesan wajib diisi.");
    const attachment = String(fd.get("attachment") ?? "");
    if (attachment && (!/^data:image\/(jpeg|png|webp);base64,/.test(attachment) || attachment.length > 1_500_000)) return fail("Lampiran harus gambar JPG/PNG/WebP < 1 MB.");
    const [ent] = await db.select().from(s.invitations).where(and(eq(s.invitations.userId, u.id), inArray(s.invitations.packageCode, ["exclusive", "custom"]))).limit(1);
    const [t] = await db.insert(s.tickets).values({ userId: u.id, subject, priority: ent ? "high" : "normal" }).returning();
    await db.insert(s.ticketMessages).values({ ticketId: t.id, userId: u.id, body, attachment });
    const owners = await db.select({ id: s.users.id }).from(s.users).where(ne(s.users.role, "customer"));
    for (const o of owners) await notify(o.id, "support", "Tiket baru", subject, `/admin/support`);
    return ok("Tiket terkirim. Kami akan membalas secepatnya.", `/app/support/${t.id}`);
  });
}
export async function replyTicketCustomerAction(fd: FormData) {
  return safe(async () => {
    const u = await assertCustomer();
    const [t] = await db.select().from(s.tickets).where(and(eq(s.tickets.id, num(fd, "ticketId")), eq(s.tickets.userId, u.id))).limit(1);
    if (!t) return fail("Tiket tidak ditemukan.");
    const body = sanitize(str(fd, "body", 2000), 2000);
    if (body.length < 2) return fail("Pesan kosong.");
    await db.insert(s.ticketMessages).values({ ticketId: t.id, userId: u.id, body });
    await db.update(s.tickets).set({ status: "open", updatedAt: new Date() }).where(eq(s.tickets.id, t.id));
    return ok("Balasan terkirim.");
  });
}
