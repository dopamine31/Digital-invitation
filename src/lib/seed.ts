import { scryptSync, randomBytes } from "crypto";
import { count } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { TEMPLATE_SEEDS } from "@/templates/registry";
import { defaultInvitationData, defaultSections, IMG_COUPLE } from "@/templates/defaults";

const g = globalThis as unknown as { __seedPromise?: Promise<void> };
export function ensureSeed() {
  return (g.__seedPromise ??= run().catch((e) => { g.__seedPromise = undefined; throw e; }));
}

const hp = (p: string) => { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`; };
let seedN = 7;
const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; };
const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86400_000 - h * 3600_000 * 0.3);

export const CATEGORY_SEEDS = [
  ["Wedding", "wedding", "💍"], ["Khitan", "khitan", "🕌"], ["Aqiqah", "aqiqah", "🍼"], ["Birthday", "birthday", "🎂"],
  ["Graduation", "graduation", "🎓"], ["Anniversary", "anniversary", "🥂"], ["Engagement", "engagement", "💞"],
  ["Baby Shower", "baby-shower", "🧸"], ["Tasyakuran", "tasyakuran", "🤲"], ["Pengajian", "pengajian", "📖"],
  ["Reuni", "reuni", "👥"], ["Event Perusahaan", "event", "🏢"], ["Acara Sekolah", "sekolah", "🏫"],
  ["Komunitas", "komunitas", "🤝"], ["Lainnya", "lainnya", "✨"],
] as const;

async function run() {
  const [{ c }] = await db.select({ c: count() }).from(s.users);
  if (c > 0) return;

  /* ---- users ---- */
  const base = { passwordHash: "", status: "active" };
  const [owner, staff, customer] = await db.insert(s.users).values([
    { ...base, name: "Owner Studio", email: "owner@demo.id", passwordHash: hp("owner123"), role: "owner", phone: "081200000001", permissions: [] },
    { ...base, name: "Sari Staff", email: "staff@demo.id", passwordHash: hp("staff123"), role: "staff", phone: "081200000002", permissions: ["orders", "support", "customers"] },
    { ...base, name: "Andi Pratama", email: "customer@demo.id", passwordHash: hp("customer123"), role: "customer", phone: "081234567890", note: "Pelanggan demo." },
  ]).returning();
  const names = ["Budi Santoso", "Citra Lestari", "Dimas Aryo", "Eka Putri", "Fajar Nugraha", "Gita Savitri", "Hana Permata", "Irfan Hakim", "Joko Widodo", "Kirana Dewi", "Lukman Hakim", "Maya Sari"];
  const extra = await db.insert(s.users).values(names.map((n, i) => ({
    name: n, email: `${n.split(" ")[0].toLowerCase()}@contoh.id`, passwordHash: hp("customer123"), role: "customer", phone: `0812${String(3000000 + i * 1111).slice(0, 7)}`,
    createdAt: daysAgo(Math.floor(rnd() * 58) + 1),
  }))).returning();
  const customers = [customer, ...extra];

  /* ---- categories & templates ---- */
  const cats = await db.insert(s.categories).values(CATEGORY_SEEDS.map(([name, slug, icon], i) => ({ name, slug, icon, sortOrder: i }))).returning();
  const catId = (slug: string) => cats.find((x) => x.slug === slug)?.id ?? cats[cats.length - 1].id;
  const tpls = await db.insert(s.templates).values(TEMPLATE_SEEDS.map((t, i) => ({
    name: t.name, slug: t.slug, categoryId: catId(t.cat), style: t.style, description: t.desc, price: t.price, tier: t.tier,
    featured: !!t.featured, isNew: !!t.isNew, popularity: t.pop * 4 + (i % 7), config: t.cfg as unknown as Record<string, unknown>, tags: t.tags,
    features: ["Cover animasi", "Countdown", "RSVP", "Galeri foto", "Google Maps", ...(t.tier !== "free" ? ["Buku tamu", "Hadiah digital"] : []), ...(t.tier === "exclusive" ? ["Video", "Live streaming"] : [])],
    sections: ["cover", "intro", "countdown", "events", "calendar", "story", "gallery", "video", "location", "rsvp", "wishes", "gift", "live", "closing", "footer"],
    createdAt: daysAgo(i * 3),
  }))).returning();

  /* ---- packages & add-ons ---- */
  const ent = (o: Record<string, unknown>) => o;
  await db.insert(s.packages).values([
    { code: "free", name: "Free", description: "Coba gratis untuk acara sederhana.", price: 0, durationDays: 30, sortOrder: 0,
      features: ["1 undangan", "Template gratis", "Section dasar", "Link publik", "RSVP dasar", "Branding platform"],
      entitlements: ent({ maxInvitations: 1, maxGuests: 20, maxPhotos: 4 }) },
    { code: "basic", name: "Basic", description: "Lengkap untuk acara kecil hingga menengah.", price: 49000, promoPrice: 39000, durationDays: 90, sortOrder: 1,
      features: ["Template Basic", "Galeri 12 foto", "Countdown & Maps", "RSVP", "Musik latar", "Aktif 90 hari"],
      entitlements: ent({ maxInvitations: 3, maxGuests: 100, maxPhotos: 12, music: true, advancedEditor: true }) },
    { code: "premium", name: "Premium", description: "Pilihan terpopuler untuk pernikahan.", price: 99000, promoPrice: 79000, durationDays: 180, sortOrder: 2, highlight: true,
      features: ["Template Premium", "Undangan personal per tamu", "Buku tamu & moderasi", "Hadiah digital", "QR Code & check-in", "Statistik dasar", "Aktif 180 hari"],
      entitlements: ent({ maxInvitations: 5, maxGuests: 500, maxPhotos: 30, music: true, personalized: true, guestbook: true, gift: true, qr: true, checkin: true, analytics: "basic", advancedEditor: true, schedule: true }) },
    { code: "exclusive", name: "Exclusive", description: "Semua fitur premium tanpa batas.", price: 199000, promoPrice: null, durationDays: 365, sortOrder: 3,
      features: ["Template Exclusive", "Tanpa branding platform", "Video & live streaming", "Statistik lanjutan", "Export data", "Proteksi password", "Custom section", "Prioritas support", "Aktif 1 tahun"],
      entitlements: ent({ maxInvitations: 10, maxGuests: 5000, maxPhotos: 60, music: true, personalized: true, guestbook: true, gift: true, video: true, live: true, qr: true, checkin: true, analytics: "advanced", exportData: true, removeBranding: true, passwordProtect: true, schedule: true, customSection: true, customDomain: true, prioritySupport: true, advancedEditor: true }) },
    { code: "custom", name: "Custom Design", description: "Desain khusus oleh tim kami: konsultasi, revisi, persetujuan.", price: 499000, durationDays: 365, sortOrder: 4,
      features: ["Desain eksklusif untuk Anda", "Konsultasi 1:1", "Request layout", "3x revisi", "Persetujuan desain", "Semua fitur Exclusive"],
      entitlements: ent({ maxInvitations: 10, maxGuests: 9999, maxPhotos: 100, music: true, personalized: true, guestbook: true, gift: true, video: true, live: true, qr: true, checkin: true, analytics: "advanced", exportData: true, removeBranding: true, passwordProtect: true, schedule: true, customSection: true, customDomain: true, prioritySupport: true, advancedEditor: true }) },
    { code: "addon-branding", name: "Hapus Branding", description: "Sembunyikan branding platform.", price: 25000, isAddon: true, sortOrder: 10, features: [], entitlements: ent({ removeBranding: true }) },
    { code: "addon-guests", name: "+500 Tamu", description: "Tambah kuota daftar tamu.", price: 29000, isAddon: true, sortOrder: 11, features: [], entitlements: ent({ maxGuests: 500 }) },
    { code: "addon-photos", name: "+20 Foto Galeri", description: "Tambah kuota foto.", price: 19000, isAddon: true, sortOrder: 12, features: [], entitlements: ent({ maxPhotos: 20 }) },
    { code: "addon-domain", name: "Custom Domain", description: "Gunakan domain sendiri.", price: 75000, isAddon: true, sortOrder: 13, features: [], entitlements: ent({ customDomain: true }) },
  ]);

  /* ---- vouchers ---- */
  await db.insert(s.vouchers).values([
    { code: "HEMAT10", type: "percent", value: 10, minTotal: 40000, quota: 200, used: 14 },
    { code: "WELCOME25K", type: "fixed", value: 25000, minTotal: 90000, quota: 100, used: 31, endsAt: new Date(Date.now() + 60 * 86400_000) },
    { code: "EXCLUSIVE50", type: "percent", value: 50, minTotal: 150000, quota: 20, used: 3, packageCode: "exclusive" },
  ]);

  /* ---- demo invitation (publik) ---- */
  const tpl = (slug: string) => tpls.find((t) => t.slug === slug)!;
  const demoData = defaultInvitationData("wedding", ["Andi Pratama", "Siti Nurhaliza"]);
  demoData.coverPhoto = IMG_COUPLE;
  demoData.gallery = [IMG_COUPLE, "/images/hero.jpg", IMG_COUPLE, "/images/hero.jpg"];
  demoData.host1.photo = IMG_COUPLE;
  demoData.family = "Keluarga Besar Bapak Budi & Bapak Hasan";
  const [inv] = await db.insert(s.invitations).values({
    userId: customer.id, templateId: tpl("luxury-gold").id, slug: "andi-dan-siti", title: "Andi & Siti", status: "published", packageCode: "premium",
    data: demoData, sections: defaultSections(), settings: { moderate: false, rsvpEnabled: true }, views: 248, shares: 31,
  }).returning();
  const [inv2] = await db.insert(s.invitations).values({
    userId: customer.id, templateId: tpl("modern-minimalist").id, slug: "aqiqah-aisyah", title: "Aqiqah Aisyah", status: "draft", packageCode: "free",
    data: defaultInvitationData("aqiqah"), sections: defaultSections(), settings: {},
  }).returning();
  void inv2;

  const guestNames = [["Bapak Budi Santoso", "Keluarga", "Keluarga Mempelai Pria"], ["Ibu Ratna Dewi", "Keluarga", "Keluarga Mempelai Pria"], ["Citra Lestari", "Teman", "Teman Kuliah"], ["Dimas Aryo", "Teman", "Teman Kuliah"],
    ["Eka Putri", "Kerja", "Kantor"], ["Fajar Nugraha", "Kerja", "Kantor"], ["Gita Savitri", "Teman", "Teman SMA"], ["Hana Permata", "Keluarga", "Keluarga Mempelai Wanita"],
    ["Irfan Hakim", "Teman", "Teman SMA"], ["Joko Widodo", "Tetangga", "RT 05"], ["Kirana Dewi", "Keluarga", "Keluarga Mempelai Wanita"], ["Lukman Hakim", "Kerja", "Kantor"]];
  const gs = await db.insert(s.guests).values(guestNames.map(([n, cat, grp], i) => ({
    invitationId: inv.id, name: n, category: cat, groupName: grp, phone: `0812${3456000 + i * 17}`, code: `demo${String(i + 1).padStart(4, "0")}`,
    shared: i < 9, sharedAt: i < 9 ? daysAgo(8 - (i % 5)) : null, opens: i < 7 ? 1 + (i % 3) : 0, openedAt: i < 7 ? daysAgo(5) : null,
    attendance: i < 5 ? "hadir" : i < 7 ? "tidak" : "pending",
    checkedInAt: i < 2 ? daysAgo(0) : null, checkedInBy: i < 2 ? "Sari Staff" : null,
  }))).returning();
  await db.insert(s.rsvps).values(gs.slice(0, 7).map((gu, i) => ({
    invitationId: inv.id, guestId: gu.id, name: gu.name, attending: i < 5, count: i < 5 ? 1 + (i % 3) : 0,
    message: i < 5 ? "Insya Allah kami hadir. Selamat berbahagia!" : "Mohon maaf belum bisa hadir, doa terbaik untuk kalian.", createdAt: daysAgo(6 - i),
  })));
  await db.insert(s.wishes).values([
    ["Citra Lestari", "Selamat menempuh hidup baru! Semoga sakinah, mawaddah, warahmah."],
    ["Dimas Aryo", "Barakallahu lakuma wa baraka alaikuma. Bahagia selalu ya!"],
    ["Eka Putri", "Happy wedding Andi & Siti! Semoga langgeng sampai kakek nenek."],
    ["Fajar Nugraha", "Selamat ya bro, ditunggu undangan baby shower-nya 😄"],
  ].map(([name, message], i) => ({ invitationId: inv.id, name, message, approved: true, createdAt: daysAgo(5 - i) })));

  /* ---- orders & payments (data demo untuk grafik) ---- */
  const pkgPrice: Record<string, number> = { free: 0, basic: 39000, premium: 79000, exclusive: 199000, custom: 499000 };
  const statuses = ["selesai", "selesai", "selesai", "dibayar", "dalam_pengerjaan", "menunggu_verifikasi", "menunggu_pembayaran", "siap_diterbitkan", "dibatalkan", "menunggu_revisi"];
  const paidLike = ["selesai", "dibayar", "dalam_pengerjaan", "siap_diterbitkan", "menunggu_revisi"];
  let seq = 1;
  const orderRows = [];
  for (let i = 0; i < 34; i++) {
    const u = customers[i % customers.length];
    const pc = ["basic", "premium", "premium", "exclusive", "basic", "custom", "premium"][Math.floor(rnd() * 7)];
    const t = tpls[Math.floor(rnd() * tpls.length)];
    const st = i < 4 ? ["menunggu_pembayaran", "menunggu_verifikasi", "dalam_pengerjaan", "dibayar"][i] : statuses[Math.floor(rnd() * statuses.length)];
    const created = daysAgo(Math.floor(rnd() * 55));
    const sub = pkgPrice[pc] + t.price;
    const disc = rnd() > 0.8 ? Math.round(sub * 0.1) : 0;
    orderRows.push({
      number: `INV-${created.toISOString().slice(0, 10).replace(/-/g, "")}-${String(1000 + seq++)}`, userId: u.id, templateId: t.id, packageCode: pc, addons: [] as string[],
      subtotal: sub, discount: disc, total: sub - disc, voucherCode: disc ? "HEMAT10" : null, status: st, isCustomDesign: pc === "custom",
      assignedTo: pc === "custom" || st === "dalam_pengerjaan" ? staff.id : null, createdAt: created, updatedAt: created,
    });
  }
  const orders = await db.insert(s.orders).values(orderRows).returning();
  await db.insert(s.payments).values(orders.filter((o) => o.status !== "menunggu_pembayaran" && o.status !== "dibatalkan").map((o) => ({
    orderId: o.id, reference: `PAY-${o.number.slice(4)}`, method: ["transfer", "qris", "gopay", "transfer"][o.id % 4], amount: o.total,
    status: o.status === "menunggu_verifikasi" ? "menunggu_verifikasi" : paidLike.includes(o.status) ? "berhasil" : "pending",
    provider: "demo", createdAt: o.createdAt,
  })));
  // pesanan customer demo terhubung ke undangan
  await db.insert(s.orders).values({
    number: "INV-DEMO-0001", userId: customer.id, templateId: tpl("luxury-gold").id, invitationId: inv.id, packageCode: "premium", subtotal: 104000, discount: 25000, total: 79000,
    voucherCode: "WELCOME25K", status: "selesai", createdAt: daysAgo(12), updatedAt: daysAgo(11),
  }).returning().then(async ([o]) => db.insert(s.payments).values({ orderId: o.id, reference: "PAY-DEMO-0001", method: "qris", amount: 79000, status: "berhasil", provider: "demo", createdAt: daysAgo(12) }));

  /* ---- notifikasi, tiket, log ---- */
  await db.insert(s.notifications).values([
    { userId: customer.id, type: "rsvp", title: "RSVP baru masuk", body: "Citra Lestari mengonfirmasi hadir (2 orang).", link: `/app/invitations/${inv.id}/rsvp`, createdAt: daysAgo(1) },
    { userId: customer.id, type: "wish", title: "Ucapan baru", body: "Eka Putri mengirim ucapan untuk Anda.", link: `/app/invitations/${inv.id}/rsvp`, createdAt: daysAgo(2) },
    { userId: customer.id, type: "payment", title: "Pembayaran diterima", body: "Pesanan INV-DEMO-0001 telah lunas.", link: "/app/orders", createdAt: daysAgo(11) },
    { userId: customer.id, type: "promo", title: "Promo Premium 20%", body: "Gunakan kode HEMAT10 untuk upgrade paket.", link: "/app/templates", createdAt: daysAgo(3), read: true },
    { userId: owner.id, type: "order", title: "Pesanan menunggu verifikasi", body: "Ada pembayaran yang perlu diverifikasi.", link: "/admin/orders", createdAt: daysAgo(0) },
    { userId: owner.id, type: "system", title: "Selamat datang di Digital Invitation Studio", body: "Lengkapi pengaturan bisnis Anda di menu Pengaturan.", link: "/admin/settings", createdAt: daysAgo(2) },
    { userId: staff.id, type: "order", title: "Pesanan ditugaskan", body: "Anda ditugaskan memproses pesanan custom design.", link: "/admin/orders", createdAt: daysAgo(1) },
  ]);
  const [tk] = await db.insert(s.tickets).values([
    { userId: customer.id, subject: "Cara menambahkan musik latar", status: "dibalas", priority: "normal", assignedTo: staff.id, createdAt: daysAgo(4), updatedAt: daysAgo(3) },
    { userId: extra[0].id, subject: "Bukti transfer belum diverifikasi", status: "open", priority: "high", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  ]).returning();
  await db.insert(s.ticketMessages).values([
    { ticketId: tk.id, userId: customer.id, isStaff: false, body: "Halo, bagaimana cara menambahkan musik latar di undangan saya?", createdAt: daysAgo(4) },
    { ticketId: tk.id, userId: staff.id, isStaff: true, body: "Halo Kak Andi! Buka Editor → tab Media → isi URL audio (.mp3) lalu simpan. Musik akan aktif setelah tamu menekan tombol Buka Undangan.", createdAt: daysAgo(3) },
  ]);
  await db.insert(s.activityLogs).values([
    { userId: owner.id, action: "Login", entity: "auth", detail: "Owner masuk ke dashboard", createdAt: daysAgo(0) },
    { userId: staff.id, action: "Ubah status pesanan", entity: "order", entityId: orders[2].id, detail: "Status → dalam_pengerjaan", createdAt: daysAgo(1) },
    { userId: owner.id, action: "Verifikasi pembayaran", entity: "payment", entityId: orders[3].id, detail: "Pembayaran terverifikasi", createdAt: daysAgo(2) },
    { userId: customer.id, action: "Publish undangan", entity: "invitation", entityId: inv.id, detail: "andi-dan-siti", createdAt: daysAgo(10) },
  ]);

  /* ---- settings ---- */
  await db.insert(s.settings).values([
    { key: "site", value: { name: "Digital Invitation Studio", tagline: "Undangan digital elegan untuk setiap momen berharga", whatsapp: "6281200000001", email: "halo@invitation.studio", address: "Jl. Sudirman No. 1, Jakarta Selatan", instagram: "https://instagram.com/", facebook: "https://facebook.com/", tiktok: "https://tiktok.com/", youtube: "https://youtube.com/", domain: "invitation.studio", brandColor: "#b08d57", logo: "", favicon: "", font: "Plus Jakarta Sans", seoTitle: "Digital Invitation Studio — Undangan Digital Premium", seoDesc: "Buat undangan digital pernikahan, khitan, aqiqah, ulang tahun dan lainnya dengan 30+ template eksklusif.", ogImage: "/images/hero.jpg", pwaName: "Digital Invitation Studio", pwaShort: "Invitation" } },
    { key: "content", value: {
      heroTitle: "Undangan digital yang terasa seperti hadiah pertama untuk tamu Anda",
      heroSubtitle: "30+ template berkarakter, editor semudah mengisi formulir, link personal untuk setiap tamu, RSVP, buku tamu, QR check-in — semua dalam satu studio.",
      banner: "Promo bulan ini: gunakan kode HEMAT10 untuk diskon 10%!",
      faq: [
        { q: "Apakah tamu harus memasang aplikasi?", a: "Tidak. Tamu cukup membuka link undangan dari WhatsApp atau browser apa pun." },
        { q: "Bagaimana cara membuat undangan personal untuk tiap tamu?", a: "Tambahkan daftar tamu (manual atau impor CSV), lalu sistem membuat link unik dengan nama tamu di cover. Kirim via WhatsApp dalam satu klik." },
        { q: "Apakah saya bisa mengubah template setelah memilih?", a: "Bisa. Data undangan Anda tetap tersimpan saat mengganti template." },
        { q: "Berapa lama undangan aktif?", a: "Sesuai paket: Free 30 hari, Basic 90 hari, Premium 180 hari, Exclusive 1 tahun." },
        { q: "Bagaimana metode pembayaran?", a: "Saat ini tersedia transfer manual dengan verifikasi admin dan simulasi pembayaran demo. Payment gateway (Midtrans/Xendit) tersedia setelah dikonfigurasi pemilik." },
        { q: "Apakah ada layanan desain khusus?", a: "Ada. Paket Custom Design memberi Anda desain eksklusif dengan konsultasi dan revisi." },
      ],
      testimonials: [
        { name: "Rani & Dika", role: "Pengantin, Bandung", text: "Tamu kami memuji undangannya. Link personalnya sangat membantu mengirim via WhatsApp." },
        { name: "Pak Hendra", role: "Aqiqah putra, Surabaya", text: "Mudah sekali! Saya tidak paham desain tapi hasilnya rapi dan cantik." },
        { name: "Nadia", role: "Wisuda S2, Yogyakarta", text: "Template tipografinya keren, RSVP dan ucapan masuk real-time ke dashboard." },
      ],
      pages: { terms: "Dengan menggunakan layanan ini Anda menyetujui bahwa konten undangan adalah tanggung jawab Anda. Pembayaran bersifat final setelah undangan diterbitkan, kecuali ada gangguan layanan dari pihak kami.", privacy: "Kami hanya menyimpan data yang dibutuhkan untuk menjalankan layanan (akun, undangan, daftar tamu, RSVP). Data tamu tidak dibagikan kepada pihak ketiga dan hanya dapat diakses pemilik undangan.", help: "Butuh bantuan? Buka Pusat Bantuan, kirim tiket, atau hubungi kami melalui WhatsApp pada jam kerja 09.00–17.00 WIB." },
    } },
    { key: "system", value: { maintenance: false, maxUploadMB: 5, maxPhotos: 60, backup: "daily", emailProvider: "none", storage: "database", twoFactor: false, sessionDays: 7, paymentProvider: "demo", bankName: "BCA", bankNumber: "8830 123 456", bankHolder: "PT Studio Undangan Digital", notifyEmail: true, notifyPush: false } },
  ]);
}
