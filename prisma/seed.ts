/**
 * Seed data realistis untuk pengembangan & acceptance demo.
 * - 3 tenant, 5 acara, 200 tamu, RSVP/check-in/kunjungan/blast acak
 * - akun Super Admin, Owner, Panitia (kata sandi ada di scripts/setup.sh)
 * Idempoten: seluruh tabel aplikasi dikosongkan lalu diisi ulang dengan ID deterministik.
 */
import "dotenv/config";
import { createHash, createHmac, randomBytes, createCipheriv } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { toInputJson } from "@/lib/db-json";
import { defaultEventSettings, defaultSections, sectionsToJson, settingsToJson } from "@/lib/sections";
import { defaultThemeConfig, themeToJson } from "@/lib/themes";
import { defaultRsvpForm } from "@/lib/rsvp";
import { maskPhone, sha256, signGuestQr } from "@/lib/crypto";
import type { TenantStatus, EventStatus, EventType, RsvpStatus } from "@/generated/prisma/enums";

const AUTH_SECRET = process.env.AUTH_SECRET ?? "rasa-dev-auth-secret-change-in-production-1234567890";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "rasa-dev-encryption-key-change-in-production-1234567890";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const now = new Date();
const days = (n: number): Date => new Date(now.getTime() + n * 24 * 3600_000);

/** PRNG deterministik supaya seed dapat direproduksi di CI & demo. */
let rngState = 20261113;
function random(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}
function int(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
function encryptLocal(plain: string): string {
  const key = createHash("sha256").update(ENCRYPTION_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
function hmac(value: string): string {
  return createHmac("sha256", AUTH_SECRET).update(value).digest("hex");
}

const FIRST = ["Ayu", "Budi", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hadi", "Intan", "Joko", "Kirana", "Lukman", "Maya", "Nadia", "Oki", "Putri", "Rizky", "Sari", "Tegar", "Umi", "Vina", "Wahyu", "Yuni", "Zaki"];
const LAST = ["Santoso", "Wulandari", "Pratama", "Kusuma", "Anggraini", "Hidayat", "Permata", "Saputra", "Rahmawati", "Setiawan", "Mahendra", "Nugroho"];
const GROUPS = ["Keluarga", "Teman", "Rekan Kerja", "VIP", "Umum"] as const;
const MEALS = ["Ayam bakar", "Ikan bakar", "Vegetarian"] as const;
const RSVP_STATUSES = ["ATTENDING", "ATTENDING", "ATTENDING", "MAYBE", "DECLINED"] as const;

interface TenantSeed { id: string; name: string; slug: string; status: TenantStatus; planId: string; ownerEmail: string; ownerName: string }
interface EventSeed {
  id: string; tenantId: string; slug: string; title: string; themeId: string;
  type: EventType; status: EventStatus; startsAt: Date; indexable: boolean; ownerId: string;
}

const planSeeds = [
  { id: "plan_starter", code: "STARTER", name: "Starter", monthlyPrice: 99000, yearlyPrice: 990000, trialDays: 14, sortOrder: 1, description: "1 acara · 100 tamu · RSVP lengkap", limits: { maxEvents: 1, maxGuestsPerEvent: 100, maxStorageMb: 100, maxBlastsPerMonth: 200, seats: 1 }, features: { customDomain: false, whiteLabel: false, apiAccess: false, webhooks: false, customFonts: false, customCss: false, removeBranding: false, livestream: false, offlineCheckin: false, advancedAnalytics: false, prioritySupport: false } },
  { id: "plan_growth", code: "GROWTH", name: "Growth", monthlyPrice: 249000, yearlyPrice: 2490000, trialDays: 14, sortOrder: 2, description: "5 acara · 1.000 tamu · blast & check-in", limits: { maxEvents: 5, maxGuestsPerEvent: 1000, maxStorageMb: 2048, maxBlastsPerMonth: 2000, seats: 5 }, features: { customDomain: false, whiteLabel: false, apiAccess: true, webhooks: true, customFonts: true, customCss: false, removeBranding: false, livestream: true, offlineCheckin: true, advancedAnalytics: true, prioritySupport: false } },
  { id: "plan_studio", code: "STUDIO", name: "Studio", monthlyPrice: 599000, yearlyPrice: 5990000, trialDays: 14, sortOrder: 3, description: "Tanpa batas · white-label · API & webhook", limits: { maxEvents: 100, maxGuestsPerEvent: 10000, maxStorageMb: 20480, maxBlastsPerMonth: 20000, seats: 25 }, features: { customDomain: true, whiteLabel: true, apiAccess: true, webhooks: true, customFonts: true, customCss: true, removeBranding: true, livestream: true, offlineCheckin: true, advancedAnalytics: true, prioritySupport: true } },
];

const tenantSeeds: TenantSeed[] = [
  { id: "tenant_harmoni", name: "Harmoni Wedding Organizer", slug: "harmoni", status: "ACTIVE", planId: "plan_studio", ownerEmail: "owner@harmoni.id", ownerName: "Rani Wulandari" },
  { id: "tenant_anggrek", name: "Anggrek Event Studio", slug: "anggrek", status: "ACTIVE", planId: "plan_growth", ownerEmail: "owner@anggrek.id", ownerName: "Dewi Anggrek" },
  { id: "tenant_nusantara", name: "Nusantara Creative", slug: "nusantara", status: "TRIAL", planId: "plan_starter", ownerEmail: "owner@nusantara.id", ownerName: "Bagas Nusantara" },
];

const eventSeeds: EventSeed[] = [
  { id: "evt_harmoni_wedding", tenantId: "tenant_harmoni", slug: "pernikahan-andi-siti", title: "Pernikahan Andi & Siti", themeId: "elegant-ivory", type: "WEDDING", status: "PUBLISHED", startsAt: days(30), indexable: true, ownerId: "user_owner_harmoni" },
  { id: "evt_harmoni_seminar", tenantId: "tenant_harmoni", slug: "seminar-kreatif-2026", title: "Seminar Kreatif Nusantara 2026", themeId: "modern-minimal", type: "SEMINAR", status: "PUBLISHED", startsAt: days(45), indexable: false, ownerId: "user_owner_harmoni" },
  { id: "evt_harmoni_birthday", tenantId: "tenant_harmoni", slug: "ulang-tahun-kirana", title: "Ulang Tahun Kirana ke-17", themeId: "bold-editorial", type: "BIRTHDAY", status: "DRAFT", startsAt: days(70), indexable: false, ownerId: "user_owner_harmoni" },
  { id: "evt_anggrek_aqiqah", tenantId: "tenant_anggrek", slug: "aqiqah-arsyila", title: "Aqiqah Arsyila Putri", themeId: "islamic-green", type: "AQIQAH", status: "PUBLISHED", startsAt: days(21), indexable: false, ownerId: "user_owner_anggrek" },
  { id: "evt_nusantara_gathering", tenantId: "tenant_nusantara", slug: "gathering-nusantara", title: "Gathering Komunitas Nusantara", themeId: "rustic", type: "CORPORATE", status: "PUBLISHED", startsAt: days(14), indexable: false, ownerId: "user_owner_nusantara" },
];

interface GuestRecord {
  id: string; tenantId: string; eventId: string; name: string; phone: string; phoneHash: string;
  token: string; qrPayload: string; email: string; groupLabel: string; paxAllocated: number;
  tableNumber: string | null; seatNumber: string | null; blacklisted: boolean; optOut: boolean;
}
const guests: GuestRecord[] = [];

function buildGuests(): void {
  eventSeeds.forEach((event, eventIndex) => {
    for (let i = 0; i < 40; i += 1) {
      const id = `g_${event.id}_${String(i + 1).padStart(3, "0")}`;
      const phone = `628${String(eventIndex + 1).padStart(2, "0")}${String(12000000 + i * 37).padStart(8, "0")}`;
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      guests.push({
        id, tenantId: event.tenantId, eventId: event.id, name,
        phone, phoneHash: sha256(phone), token: `tok_${event.id}_${String(i + 1).padStart(3, "0")}`,
        qrPayload: signGuestQr(event.id, id, `n${eventIndex}${i}`),
        email: `tamu${eventIndex + 1}${String(i + 1).padStart(3, "0")}@example.id`,
        groupLabel: pick(GROUPS), paxAllocated: int(1, 4),
        tableNumber: i < 24 ? `M${String(Math.floor(i / 4) + 1).padStart(2, "0")}` : null,
        seatNumber: i < 24 ? `K${(i % 4) + 1}` : null,
        blacklisted: i === 37, optOut: i === 38 || i === 39,
      });
    }
  });
}

async function reset(): Promise<boolean> {
  const userCount = await prisma.user.count();
  if (userCount > 0 && process.env.FORCE_SEED !== "true") {
    console.log("[seed] dilewati: database sudah berisi data. Gunakan FORCE_SEED=true / npm run db:reset untuk mengisi ulang.");
    return false;
  }
  if (process.env.NODE_ENV === "production" && process.env.FORCE_SEED !== "true") {
    throw new Error("Seed produksi ditolak. Set FORCE_SEED=true hanya bila Anda memang ingin mengosongkan data.");
  }
  const tables = [
    "Tenant", "User", "Membership", "Session", "VerificationToken", "Plan", "Subscription", "Invoice", "Transaction",
    "Coupon", "CouponRedemption", "Referral", "Payout", "Event", "EventVersion", "EventSchedule", "Guest", "RsvpForm",
    "Rsvp", "GuestVisit", "Wish", "GuestBookEntry", "CheckIn", "SeatingTable", "Blast", "BlastMessage", "Reminder",
    "Notification", "NotificationLog", "ApiKey", "Webhook", "WebhookDelivery", "AuditLog", "MediaAsset", "Template",
    "Announcement", "FeatureFlag", "SystemSetting", "Comment", "ReportAbuse", "QuotaUsage",
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`);
  return true;
}

async function main(): Promise<void> {
  const shouldSeed = await reset();
  if (!shouldSeed) return;
  buildGuests();

  await prisma.plan.createMany({
    data: planSeeds.map((plan) => ({
      id: plan.id, code: plan.code, name: plan.name, description: plan.description,
      monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, trialDays: plan.trialDays,
      limits: toInputJson(plan.limits), features: toInputJson(plan.features),
      isActive: true, sortOrder: plan.sortOrder,
    })),
  });

  await prisma.tenant.createMany({
    data: tenantSeeds.map((tenant) => ({
      id: tenant.id, name: tenant.name, slug: tenant.slug, subdomain: tenant.slug,
      status: tenant.status, planId: tenant.planId,
      customDomain: tenant.slug === "harmoni" ? "undangan.harmoni.id" : null,
      branding: toInputJson({ primaryColor: "#9A7B4F", tagline: "Undangan digital yang berkesan" }),
      themeConfig: toInputJson({ themeId: "elegant-ivory" }),
      trialEndsAt: tenant.status === "TRIAL" ? days(14) : null,
    })),
  });

  const passwordSuper = await bcrypt.hash("SuperAdmin!234", 12);
  const passwordOwner = await bcrypt.hash("Owner!234", 12);
  const passwordStaff = await bcrypt.hash("Panitia!234", 12);
  await prisma.user.createMany({
    data: [
      { id: "user_superadmin", tenantId: null, platformRole: "SUPER_ADMIN", email: "superadmin@rasa.id", passwordHash: passwordSuper, name: "Arya Pratama", status: "ACTIVE", emailVerifiedAt: days(-1), locale: "id" },
      ...tenantSeeds.map((tenant) => ({
        id: `user_owner_${tenant.slug}`, tenantId: tenant.id, platformRole: "USER" as const,
        email: tenant.ownerEmail, passwordHash: passwordOwner, name: tenant.ownerName,
        status: "ACTIVE" as const, emailVerifiedAt: days(-1), locale: "id" as const,
      })),
      { id: "user_panitia_harmoni", tenantId: "tenant_harmoni", platformRole: "USER", email: "panitia@harmoni.id", passwordHash: passwordStaff, name: "Panitia Harmoni", status: "ACTIVE", emailVerifiedAt: days(-1), locale: "id" },
      { id: "user_editor_harmoni", tenantId: "tenant_harmoni", platformRole: "USER", email: "editor@harmoni.id", passwordHash: passwordOwner, name: "Editor Harmoni", status: "ACTIVE", emailVerifiedAt: days(-1), locale: "id" },
      { id: "user_cohost_harmoni", tenantId: "tenant_harmoni", platformRole: "USER", email: "cohost@harmoni.id", passwordHash: passwordOwner, name: "Co-Host Harmoni", status: "ACTIVE", emailVerifiedAt: days(-1), locale: "id" },
    ],
  });

  await prisma.membership.createMany({
    data: [
      ...tenantSeeds.flatMap((tenant) => [
        { id: `mem_owner_${tenant.slug}`, tenantId: tenant.id, userId: `user_owner_${tenant.slug}`, role: "TENANT_ADMIN" as const, eventId: null, invitedBy: "user_superadmin" },
        { id: `mem_eventowner_${tenant.slug}`, tenantId: tenant.id, userId: `user_owner_${tenant.slug}`, role: "EVENT_OWNER" as const, eventId: null, invitedBy: "user_superadmin" },
      ]),
      { id: "mem_panitia_harmoni", tenantId: "tenant_harmoni", userId: "user_panitia_harmoni", role: "CHECKIN_STAFF", eventId: "evt_harmoni_wedding", invitedBy: "user_owner_harmoni" },
      { id: "mem_editor_harmoni", tenantId: "tenant_harmoni", userId: "user_editor_harmoni", role: "EDITOR", eventId: "evt_harmoni_wedding", invitedBy: "user_owner_harmoni" },
      { id: "mem_cohost_harmoni", tenantId: "tenant_harmoni", userId: "user_cohost_harmoni", role: "CO_HOST", eventId: "evt_harmoni_wedding", invitedBy: "user_owner_harmoni" },
    ],
  });

  await prisma.event.createMany({
    data: eventSeeds.map((event) => {
      const settings = defaultEventSettings(event.title);
      settings.pic.name = event.tenantId === "tenant_harmoni" ? "Rani Wulandari" : settings.pic.name;
      settings.pic.phone = event.tenantId === "tenant_harmoni" ? "081234567890" : "081298765432";
      settings.pic.showOnCover = true;
      settings.noindex = !event.indexable;
      return {
        id: event.id, tenantId: event.tenantId, slug: event.slug, title: event.title,
        type: event.type, status: event.status, startsAt: event.startsAt,
        endsAt: new Date(event.startsAt.getTime() + 5 * 3600_000),
        timezone: "Asia/Jakarta", themeId: event.themeId,
        themeConfig: toInputJson(themeToJson(defaultThemeConfig(event.themeId))),
        sections: toInputJson(sectionsToJson(defaultSections())),
        settings: toInputJson(settingsToJson(settings)),
        meta: toInputJson({ seed: true, estimatedGuests: 40, source: "rasa-seed" }),
        coverImageUrl: null,
        publishedAt: event.status === "PUBLISHED" ? days(-7) : null,
        indexable: event.indexable, createdBy: event.ownerId,
      };
    }),
  });

  await prisma.eventVersion.createMany({
    data: eventSeeds.map((event) => ({
      id: `ver_${event.id}_1`, tenantId: event.tenantId, eventId: event.id, version: 1,
      snapshot: toInputJson({ title: event.title, themeId: event.themeId, sections: defaultSections() }),
      note: "Versi awal dari seed", createdBy: event.ownerId,
    })),
  });

  await prisma.eventSchedule.createMany({
    data: eventSeeds.flatMap((event) => ([
      {
        id: `sch_${event.id}_1`, tenantId: event.tenantId, eventId: event.id,
        title: event.type === "WEDDING" ? "Akad Nikah" : "Sesi Utama",
        startsAt: event.startsAt, endsAt: new Date(event.startsAt.getTime() + 2 * 3600_000),
        timezone: "Asia/Jakarta", venueName: "Grand Ballroom Hotel Majapahit",
        address: "Jl. Tunjungan No. 65, Surabaya, Jawa Timur",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Hotel+Majapahit+Surabaya",
        sortOrder: 1, note: "Hadir 30 menit sebelum acara.",
      },
      {
        id: `sch_${event.id}_2`, tenantId: event.tenantId, eventId: event.id,
        title: event.type === "WEDDING" ? "Resepsi" : "Ramah Tamah",
        startsAt: new Date(event.startsAt.getTime() + 2 * 3600_000),
        endsAt: new Date(event.startsAt.getTime() + 5 * 3600_000),
        timezone: "Asia/Jakarta", venueName: "Grand Ballroom Hotel Majapahit",
        address: "Jl. Tunjungan No. 65, Surabaya, Jawa Timur",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Hotel+Majapahit+Surabaya",
        sortOrder: 2, note: null,
      },
    ])),
  });

  const form = defaultRsvpForm();
  await prisma.rsvpForm.createMany({
    data: eventSeeds.map((event) => ({
      id: `form_${event.id}`, tenantId: event.tenantId, eventId: event.id,
      fields: toInputJson(form.fields), settings: toInputJson(form.settings),
      locales: toInputJson(form.locales),
      deadlineAt: new Date(event.startsAt.getTime() - 24 * 3600_000),
      paxQuotaPerGuest: 4, isClosed: false,
      thankYouMessage: form.thankYouMessage, redirectUrl: null,
    })),
  });

  await prisma.guest.createMany({
    data: guests.map((guest, index) => ({
      id: guest.id, tenantId: guest.tenantId, eventId: guest.eventId, name: guest.name,
      phoneEncrypted: encryptLocal(guest.phone), phoneMasked: maskPhone(guest.phone),
      phoneHash: guest.phoneHash, email: guest.email,
      token: guest.token, qrPayload: guest.qrPayload,
      groupLabel: guest.groupLabel, tags: toInputJson([guest.groupLabel, "seed"]),
      paxAllocated: guest.paxAllocated, paxConfirmed: 0,
      customFields: toInputJson({ undangan: "digital", kota: pick(["Surabaya", "Sidoarjo", "Malang", "Jakarta"]) }),
      notes: index % 11 === 0 ? "Tamu VIP — perlu pendampingan" : null,
      seatNumber: guest.seatNumber, tableNumber: guest.tableNumber,
      blacklisted: guest.blacklisted, optOut: guest.optOut, walkIn: false,
      invitedAt: days(-10), lastOpenedAt: index % 3 === 0 ? days(-int(0, 7)) : null,
    })),
  });

  const rsvpRows: {
    id: string; tenantId: string; eventId: string; guestId: string; status: RsvpStatus; pax: number;
    answers: ReturnType<typeof toInputJson>; sessionId: string | null; mealChoice: string | null;
    attendanceNote: string | null; editTokenHash: string; utmSource: string | null; submittedAt: Date;
  }[] = [];
  const checkInRows: { id: string; tenantId: string; eventId: string; guestId: string; station: string; deviceId: string; method: string; at: Date }[] = [];
  const visitRows: { id: string; tenantId: string; eventId: string; guestId: string; sectionKey: string; path: string; utmSource: string | null; createdAt: Date }[] = [];
  const notificationRows: { id: string; tenantId: string; title: string; body: string; eventType: string; payload: ReturnType<typeof toInputJson>; createdAt: Date }[] = [];

  guests.forEach((guest, index) => {
    const visitCount = int(1, 4);
    for (let v = 0; v < visitCount; v += 1) {
      visitRows.push({
        id: `visit_${guest.id}_${v}`, tenantId: guest.tenantId, eventId: guest.eventId, guestId: guest.id,
        sectionKey: pick(["cover", "couple", "saveDate", "schedule", "rsvp", "gallery", "wishes"]),
        path: `/i/${eventSeeds.find((event) => event.id === guest.eventId)?.slug ?? "undangan"}`,
        utmSource: pick(["whatsapp", "instagram", "direct", "email"]),
        createdAt: days(-int(0, 9)),
      });
    }
    if (random() > 0.32 && !guest.blacklisted && !guest.optOut) {
      const status = pick(RSVP_STATUSES);
      const pax = status === "DECLINED" ? 0 : Math.min(guest.paxAllocated, int(1, 3));
      const editToken = `edit_${guest.id}`;
      rsvpRows.push({
        id: `rsvp_${guest.id}`, tenantId: guest.tenantId, eventId: guest.eventId, guestId: guest.id,
        status, pax, answers: toInputJson({
          dietary: pick(["regular", "vegetarian", "tanpa-pedas"]),
          relation: pick(["keluarga", "teman", "rekan-kerja"]),
          accommodation: random() > 0.7,
          message: "Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.",
        }),
        sessionId: pick(["sesi-1", "sesi-2"]), mealChoice: pick(MEALS),
        attendanceNote: index % 9 === 0 ? "Mohon kursi dekat pintu masuk." : null,
        editTokenHash: sha256(editToken),
        utmSource: pick(["whatsapp", "instagram", null]),
        submittedAt: days(-int(0, 8)),
      });
      notificationRows.push({
        id: `notif_${guest.id}`, tenantId: guest.tenantId,
        title: `RSVP ${guest.name}`, body: `${guest.name} mengirim konfirmasi ${status} (${pax || 1} tamu).`,
        eventType: "rsvp.created", payload: toInputJson({ guestId: guest.id, status, pax }),
        createdAt: days(-int(0, 8)),
      });
      if (status === "ATTENDING" && random() > 0.55) {
        checkInRows.push({
          id: `cin_${guest.id}`, tenantId: guest.tenantId, eventId: guest.eventId, guestId: guest.id,
          station: pick(["loket-1", "loket-2", "loket-vip"]),
          deviceId: pick(["tablet-a", "tablet-b", "phone-panitia"]),
          method: "QR", at: days(-int(0, 2)),
        });
      }
    }
  });

  await prisma.rsvp.createMany({ data: rsvpRows });
  await prisma.guestVisit.createMany({ data: visitRows });
  await prisma.checkIn.createMany({ data: checkInRows });
  await prisma.notification.createMany({ data: notificationRows.map((row) => ({ ...row, userId: null, channel: "IN_APP", toMasked: null, status: "SENT", readAt: null })) });

  await prisma.wish.createMany({
    data: Array.from({ length: 24 }, (_, index) => {
      const guest = guests[(index * 7) % guests.length] as GuestRecord;
      return {
        id: `wish_${index}`, tenantId: guest.tenantId, eventId: guest.eventId, guestId: guest.id,
        authorName: guest.name,
        message: pick([
          "Selamat ya, semoga langgeng sampai kiamat kelak.",
          "Semoga acaranya lancar dan penuh keberkahan.",
          "Turut berbahagia atas hari istimewa ini!",
          "Doa terbaik untuk keluarga baru kalian.",
        ]),
        status: index % 5 === 0 ? "PENDING" : "APPROVED",
        reply: index % 6 === 0 ? "Terima kasih banyak atas doanya." : null,
        moderatedAt: index % 5 === 0 ? null : days(-2),
        moderatedBy: index % 5 === 0 ? null : "user_owner_harmoni",
        createdAt: days(-int(1, 7)),
      };
    }),
  });
  await prisma.guestBookEntry.createMany({
    data: Array.from({ length: 18 }, (_, index) => {
      const guest = guests[(index * 11) % guests.length] as GuestRecord;
      return {
        id: `gb_${index}`, tenantId: guest.tenantId, eventId: guest.eventId, guestId: guest.id,
        name: guest.name, message: "Hadir dengan penuh suka cita.", createdAt: days(-int(0, 5)),
      };
    }),
  });

  await prisma.seatingTable.createMany({
    data: eventSeeds.flatMap((event) => Array.from({ length: 6 }, (_, index) => ({
      id: `table_${event.id}_${index + 1}`, tenantId: event.tenantId, eventId: event.id,
      name: `M${String(index + 1).padStart(2, "0")}`, capacity: 8, shape: index % 2 === 0 ? "ROUND" : "RECTANGLE",
      position: toInputJson({ x: (index % 3) * 180 + 40, y: Math.floor(index / 3) * 160 + 40 }),
    }))),
  });

  await prisma.blast.createMany({
    data: eventSeeds.flatMap((event, eventIndex) => ([
      {
        id: `blast_${event.id}_1`, tenantId: event.tenantId, eventId: event.id,
        channel: "WHATSAPP", name: "Undangan perdana",
        templateBody: "Assalamu'alaikum {{nama}}, kami mengundang Bapak/Ibu ke *{{acara}}*. Link personal: {{link}}. Hubungi PIC {{pic_nama}} ({{pic_hp}}).",
        filters: toInputJson({ groups: [] }), scheduledAt: null,
        status: "COMPLETED", throttlePerMinute: 60, total: 40, sent: 38, failed: 0,
        createdBy: event.ownerId, startedAt: days(-8), finishedAt: days(-8),
      },
      {
        id: `blast_${event.id}_2`, tenantId: event.tenantId, eventId: event.id,
        channel: "WHATSAPP", name: "Pengingat H-3",
        templateBody: "Halo {{nama}}, pengingat acara {{acara}} pada {{tanggal}}. Link: {{link}}",
        filters: toInputJson({ groups: ["Keluarga", "VIP"] }),
        scheduledAt: days(-2), status: eventIndex < 2 ? "COMPLETED" : "SCHEDULED",
        throttlePerMinute: 60, total: 16, sent: eventIndex < 2 ? 16 : 0, failed: 0,
        createdBy: event.ownerId, startedAt: eventIndex < 2 ? days(-2) : null,
        finishedAt: eventIndex < 2 ? days(-2) : null,
      },
    ])),
  });
  await prisma.blastMessage.createMany({
    data: guests.flatMap((guest, index) => ([
      {
        id: `bm_${guest.id}_1`, tenantId: guest.tenantId, blastId: `blast_${guest.eventId}_1`,
        guestId: guest.id, toMasked: maskPhone(guest.phone),
        body: `Assalamu'alaikum ${guest.name}, undangan ${eventSeeds.find((event) => event.id === guest.eventId)?.title ?? ""}: ${BASE_URL}/i/pernikahan-andi-siti?to=${guest.token}`,
        status: guest.optOut ? "OPTED_OUT" : guest.blacklisted ? "FAILED" : pick(["SENT", "DELIVERED", "READ", "REPLIED"]),
        error: guest.blacklisted ? "Nomor masuk blacklist" : null,
        providerMessageId: `mock-${index}`, sentAt: days(-8),
        readAt: index % 4 === 0 ? days(-7) : null,
        repliedAt: index % 9 === 0 ? days(-6) : null,
      },
    ])),
  });
  await prisma.reminder.createMany({
    data: eventSeeds.flatMap((event) => [7, 3, 1].map((offset) => ({
      id: `rem_${event.id}_${offset}`, tenantId: event.tenantId, eventId: event.id,
      blastId: `blast_${event.id}_1`, channel: "WHATSAPP", offsetDays: offset,
      templateBody: "Halo {{nama}}, pengingat {{acara}} {{link}}",
      scheduledFor: new Date(event.startsAt.getTime() - offset * 24 * 3600_000),
      status: "SCHEDULED", jobId: `rem-${offset}-${event.id}`,
    }))),
  });
  await prisma.notificationLog.createMany({
    data: Array.from({ length: 60 }, (_, index) => {
      const guest = guests[index % guests.length] as GuestRecord;
      return {
        id: `nlog_${index}`, tenantId: guest.tenantId,
        channel: index % 4 === 0 ? "EMAIL" : "WHATSAPP",
        provider: "MOCK", toMasked: maskPhone(guest.phone), templateKey: "rsvp.confirmation",
        payload: toInputJson({ nama: guest.name, masked: true }),
        status: index % 13 === 0 ? "FAILED" : "SENT",
        response: toInputJson({ mock: true }), createdAt: days(-int(0, 10)),
      };
    }),
  });

  await prisma.subscription.createMany({
    data: tenantSeeds.map((tenant) => ({
      id: `sub_${tenant.slug}`, tenantId: tenant.id, planId: tenant.planId,
      status: tenant.status === "TRIAL" ? "TRIALING" : "ACTIVE", billingCycle: "MONTHLY",
      startedAt: days(-45), currentPeriodEnd: days(15), graceUntil: null,
      cancelledAt: null, autoRenew: true,
    })),
  });
  await prisma.invoice.createMany({
    data: tenantSeeds.flatMap((tenant, tenantIndex) => Array.from({ length: 3 }, (_, index) => ({
      id: `inv_${tenant.slug}_${index}`, tenantId: tenant.id,
      number: `INV/2026/${tenant.slug.toUpperCase()}/${String(index + 1).padStart(3, "0")}`,
      subscriptionId: `sub_${tenant.slug}`, planId: tenant.planId,
      amount: planSeeds.find((plan) => plan.id === tenant.planId)?.monthlyPrice ?? 99000,
      discount: index === 0 ? 20000 : 0, tax: 0,
      total: (planSeeds.find((plan) => plan.id === tenant.planId)?.monthlyPrice ?? 99000) - (index === 0 ? 20000 : 0),
      currency: "IDR", status: index === 2 ? "PENDING" : "PAID",
      issuedAt: days(-60 + index * 30 + tenantIndex), dueAt: days(-57 + index * 30 + tenantIndex),
      paidAt: index === 2 ? null : days(-58 + index * 30), provider: "MOCK",
      providerRef: `mock-${tenant.slug}-${index}`, couponCode: index === 0 ? "RASA20" : null,
      meta: toInputJson({ cycle: "MONTHLY", seed: true }),
    }))),
  });
  await prisma.transaction.createMany({
    data: tenantSeeds.flatMap((tenant) => [0, 1].map((index) => ({
      id: `tx_${tenant.slug}_${index}`, tenantId: tenant.id, invoiceId: `inv_${tenant.slug}_${index}`,
      amount: (planSeeds.find((plan) => plan.id === tenant.planId)?.monthlyPrice ?? 99000) - (index === 0 ? 20000 : 0),
      provider: "MOCK", providerRef: `mock-tx-${tenant.slug}-${index}`, status: "PAID",
      rawPayload: toInputJson({ seed: true }), createdAt: days(-58 + index * 30),
    }))),
  });

  await prisma.coupon.createMany({
    data: [
      { id: "coupon_rasa20", code: "RASA20", description: "Diskon peluncuran 20%", type: "PERCENT", value: 20, maxRedemptions: 100, redeemedCount: 3, validUntil: days(90), appliesToPlanIds: toInputJson(planSeeds.map((plan) => plan.id)), active: true, createdBy: "user_superadmin" },
      { id: "coupon_lebaran", code: "LEBARAN50", description: "Potongan Rp50.000", type: "FIXED", value: 50000, maxRedemptions: 50, redeemedCount: 0, validUntil: days(30), appliesToPlanIds: toInputJson([]), active: true, createdBy: "user_superadmin" },
    ],
  });
  await prisma.referral.createMany({
    data: tenantSeeds.map((tenant, index) => ({
      id: `ref_${tenant.slug}`, tenantId: tenant.id, code: `RASA-${tenant.slug.toUpperCase()}`,
      referredTenantId: index === 2 ? "tenant_harmoni" : null,
      commissionPercent: 10, totalEarned: index === 0 ? 150000 : 0, status: "ACTIVE",
    })),
  });
  await prisma.payout.createMany({
    data: [{ id: "payout_1", referralId: "ref_harmoni", amount: 150000, status: "PAID", note: "Komisi Q3 2026", paidAt: days(-10) }],
  });

  await prisma.apiKey.createMany({
    data: tenantSeeds.map((tenant, index) => {
      const key = `rk_demo_${tenant.slug}_${index}`;
      return {
        id: `apikey_${tenant.slug}`, tenantId: tenant.id, name: `Integrasi ${tenant.name}`,
        prefix: `rk_demo_${tenant.slug}`, keyHash: sha256(key),
        secretEncrypted: encryptLocal(`whsec_${tenant.slug}`),
        scopes: toInputJson(["events.read", "rsvp.read", "rsvp.write", "checkin.write"]),
        lastUsedAt: days(-2), revokedAt: null, createdBy: `user_owner_${tenant.slug}`,
      };
    }),
  });
  await prisma.webhook.createMany({
    data: tenantSeeds.map((tenant) => ({
      id: `hook_${tenant.slug}`, tenantId: tenant.id,
      url: `https://webhook.site/rasa-${tenant.slug}`,
      secretEncrypted: encryptLocal(`whsec_${tenant.slug}`),
      events: toInputJson(["rsvp.created", "rsvp.updated", "guest.checked_in", "order.paid"]),
      active: true, description: "Endpoint demo",
    })),
  });
  await prisma.webhookDelivery.createMany({
    data: Array.from({ length: 12 }, (_, index) => ({
      id: `wdel_${index}`, tenantId: tenantSeeds[index % 3]!.id,
      webhookId: `hook_${tenantSeeds[index % 3]!.slug}`,
      eventType: pick(["rsvp.created", "rsvp.updated", "guest.checked_in", "order.paid"]),
      payload: toInputJson({ demo: true, index }),
      signature: hmac(`demo-${index}`).slice(0, 24),
      status: index % 5 === 0 ? "FAILED" : "DELIVERED", attempts: index % 5 === 0 ? 2 : 1,
      lastError: index % 5 === 0 ? "Timeout simulasi" : null,
      nextRetryAt: index % 5 === 0 ? days(1) : null,
      deliveredAt: index % 5 === 0 ? null : days(-1),
    })),
  });

  await prisma.template.createMany({
    data: [
      { id: "tpl_elegant", code: "ELEGANT-IVORY", name: "Elegant Ivory", category: "Pernikahan", tags: toInputJson(["premium", "klasik"]), themeId: "elegant-ivory", config: toInputJson(defaultThemeConfig("elegant-ivory")), status: "PUBLISHED", featured: true, createdBy: "user_superadmin" },
      { id: "tpl_jawa", code: "ADAT-JAWA", name: "Adat Jawa", category: "Adat", tags: toInputJson(["budaya", "jawa"]), themeId: "adat-jawa", config: toInputJson(defaultThemeConfig("adat-jawa")), status: "PUBLISHED", featured: true, createdBy: "user_superadmin" },
      { id: "tpl_islamic", code: "ISLAMIC-GREEN", name: "Islamic Green", category: "Islami", tags: toInputJson(["islamic", "aqiqah"]), themeId: "islamic-green", config: toInputJson(defaultThemeConfig("islamic-green")), status: "PUBLISHED", featured: false, createdBy: "user_superadmin" },
      { id: "tpl_luxe", code: "LUXE-GOLD-DARK", name: "Luxe Gold Dark", category: "Premium", tags: toInputJson(["dark", "luxury"]), themeId: "luxe-gold-dark", config: toInputJson(defaultThemeConfig("luxe-gold-dark")), status: "DRAFT", featured: false, createdBy: "user_superadmin" },
    ],
  });
  await prisma.announcement.createMany({
    data: [
      { id: "ann_1", title: "Fitur editor versi 2", body: "Versioning, rollback, dan live preview tiga perangkat kini tersedia.", audience: toInputJson(["all"]), active: true, publishedAt: days(-5), createdBy: "user_superadmin" },
      { id: "ann_2", title: "Maintenance terjadwal", body: "Pemeliharaan Singkat pada Minggu pukul 01.00–02.00 WIB.", audience: toInputJson(["active"]), active: false, publishedAt: days(-20), createdBy: "user_superadmin" },
    ],
  });
  await prisma.featureFlag.createMany({
    data: [
      { id: "flag_custom_css", key: "customCss", description: "CSS kustom di editor", enabledGlobally: true, tenantOverrides: toInputJson({}) },
      { id: "flag_offline", key: "offlineCheckin", description: "Sinkronisasi check-in offline", enabledGlobally: true, tenantOverrides: toInputJson({}) },
      { id: "flag_livestream", key: "livestream", description: "Section siaran langsung", enabledGlobally: false, tenantOverrides: toInputJson({ tenant_harmoni: true }) },
    ],
  });
  await prisma.systemSetting.createMany({
    data: [
      { key: "maintenance", value: toInputJson({ enabled: false }), updatedBy: "user_superadmin" },
      { key: "payment", value: toInputJson({ adapter: "mock", currency: "IDR" }), updatedBy: "user_superadmin" },
      { key: "whatsapp", value: toInputJson({ adapter: "mock", throttlePerMinute: 60 }), updatedBy: "user_superadmin" },
      { key: "email", value: toInputJson({ adapter: "mock", smtpHost: "mailhog", smtpPort: 1025 }), updatedBy: "user_superadmin" },
      { key: "storage", value: toInputJson({ provider: "minio", bucket: "rasa-media" }), updatedBy: "user_superadmin" },
      { key: "domainWhitelist", value: toInputJson(["rasa.id", "harmoni.id"]), updatedBy: "user_superadmin" },
      { key: "seo", value: toInputJson({ defaultNoindex: true }), updatedBy: "user_superadmin" },
      { key: "language", value: toInputJson({ default: "id", supported: ["id", "en"] }), updatedBy: "user_superadmin" },
      { key: "currency", value: toInputJson({ default: "IDR" }), updatedBy: "user_superadmin" },
      { key: "backup", value: toInputJson({ schedule: "daily", retentionDays: 30 }), updatedBy: "user_superadmin" },
      { key: "retention", value: toInputJson({ auditDays: 365, guestDays: 730 }), updatedBy: "user_superadmin" },
    ],
  });
  await prisma.comment.createMany({
    data: Array.from({ length: 8 }, (_, index) => ({
      id: `comment_${index}`, tenantId: "tenant_harmoni", eventId: "evt_harmoni_wedding",
      authorId: index % 2 === 0 ? "user_editor_harmoni" : "user_cohost_harmoni",
      body: pick(["Tolong perbesar foto sampul.", "Urutan gallery sudah oke.", "PIC perlu ditonjolkan di cover.", "Teks pembuka perlu versi Inggris."]),
      sectionKey: pick(["cover", "gallery", "contact"]), resolved: index % 3 === 0,
    })),
  });
  await prisma.reportAbuse.createMany({
    data: [
      { id: "report_1", tenantId: "tenant_anggrek", eventId: "evt_anggrek_aqiqah", reporterEmail: "warga@example.id", reason: "Konten tidak pantas", details: "Mohon periksa bagian ucapan.", status: "OPEN", createdAt: days(-2) },
      { id: "report_2", tenantId: "tenant_harmoni", eventId: "evt_harmoni_wedding", reporterEmail: "tamu@example.id", reason: "Link mencurigakan", details: "Salah kirim nomor.", status: "RESOLVED", resolvedAt: days(-1), createdAt: days(-4) },
    ],
  });
  await prisma.quotaUsage.createMany({
    data: tenantSeeds.flatMap((tenant) => [
      { id: `quota_${tenant.slug}_blasts`, tenantId: tenant.id, metric: "blasts", period: now.toISOString().slice(0, 7), used: 2 },
      { id: `quota_${tenant.slug}_storage`, tenantId: tenant.id, metric: "storage", period: now.toISOString().slice(0, 7), used: 12 },
    ]),
  });
  await prisma.mediaAsset.createMany({
    data: eventSeeds.slice(0, 3).map((event, index) => ({
      id: `asset_${event.id}`, tenantId: event.tenantId,
      key: `tenants/${event.tenantId}/events/${event.id}/cover-${index}.jpg`,
      originalName: `cover-${index}.jpg`, mime: "image/jpeg", sizeBytes: 240_000 + index * 18_000,
      width: 1600, height: 900, uploadedBy: event.ownerId,
    })),
  });
  await prisma.auditLog.createMany({
    data: [
      { id: "audit_1", tenantId: "tenant_harmoni", actorId: "user_superadmin", actorEmail: "superadmin@rasa.id", action: "tenant.plan", entity: "Tenant", entityId: "tenant_harmoni", after: toInputJson({ planCode: "STUDIO" }), createdAt: days(-12) },
      { id: "audit_2", tenantId: "tenant_harmoni", actorId: "user_owner_harmoni", actorEmail: "owner@harmoni.id", action: "event.publish", entity: "Event", entityId: "evt_harmoni_wedding", after: toInputJson({ status: "PUBLISHED" }), createdAt: days(-7) },
      { id: "audit_3", tenantId: null, actorId: "user_superadmin", actorEmail: "superadmin@rasa.id", action: "system.setting", entity: "SystemSetting", entityId: "maintenance", after: toInputJson({ enabled: false }), createdAt: days(-3) },
      { id: "audit_4", tenantId: "tenant_harmoni", actorId: "user_panitia_harmoni", actorEmail: "panitia@harmoni.id", action: "checkin.offline_sync", entity: "CheckIn", entityId: "evt_harmoni_wedding", after: toInputJson({ synced: 3 }), createdAt: days(-1) },
    ],
  });

  console.log("[seed] selesai: 3 tenant, 5 acara, 200 tamu, %d RSVP, %d check-in, %d kunjungan.", rsvpRows.length, checkInRows.length, visitRows.length);
  console.log("[seed] demo: superadmin@rasa.id / SuperAdmin!234 · owner@harmoni.id / Owner!234 · panitia@harmoni.id / Panitia!234");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
