import type { EventSettings, JsonObject, SectionConfig, SectionType } from "@/lib/types";

export interface SectionDefinition {
  type: SectionType;
  labelKey: string;
  icon: string;
  repeatable: boolean;
  description: string;
}

export const SECTION_LIBRARY: readonly SectionDefinition[] = [
  { type: "cover", labelKey: "cover.open", icon: "Sparkles", repeatable: false, description: "Sampul pembuka + nama tamu + PIC" },
  { type: "couple", labelKey: "section.couple", icon: "Heart", repeatable: true, description: "Mempelai & orang tua" },
  { type: "saveDate", labelKey: "section.saveDate", icon: "CalendarDays", repeatable: true, description: "Save the date + countdown" },
  { type: "schedule", labelKey: "section.schedule", icon: "MapPin", repeatable: true, description: "Detail multi-acara, timezone & peta" },
  { type: "loveStory", labelKey: "section.loveStory", icon: "BookHeart", repeatable: true, description: "Timeline cerita" },
  { type: "gallery", labelKey: "section.gallery", icon: "Images", repeatable: true, description: "Foto/video + lightbox" },
  { type: "livestream", labelKey: "section.livestream", icon: "Radio", repeatable: true, description: "YouTube / Zoom / IG" },
  { type: "quotes", labelKey: "section.quotes", icon: "Quote", repeatable: true, description: "Kutipan" },
  { type: "dressCode", labelKey: "section.dressCode", icon: "Shirt", repeatable: true, description: "Aturan berpakaian" },
  { type: "gift", labelKey: "section.gift", icon: "Gift", repeatable: true, description: "Rekening, e-wallet, QRIS" },
  { type: "wishes", labelKey: "section.wishes", icon: "MessageCircleHeart", repeatable: true, description: "Ucapan + moderasi + balasan" },
  { type: "health", labelKey: "section.health", icon: "ShieldCheck", repeatable: true, description: "Protokol kesehatan" },
  { type: "turutMengundang", labelKey: "section.turutMengundang", icon: "Users", repeatable: true, description: "Turut mengundang" },
  { type: "faq", labelKey: "section.faq", icon: "CircleHelp", repeatable: true, description: "Pertanyaan umum" },
  { type: "rundown", labelKey: "section.rundown", icon: "ListOrdered", repeatable: true, description: "Susunan acara" },
  { type: "contact", labelKey: "section.contact", icon: "Phone", repeatable: true, description: "Kontak & PIC" },
  { type: "rsvp", labelKey: "section.rsvp", icon: "ClipboardCheck", repeatable: false, description: "Form konfirmasi kehadiran" },
  { type: "guestBook", labelKey: "section.guestBook", icon: "PenLine", repeatable: true, description: "Buku tamu digital" },
  { type: "footer", labelKey: "section.footer", icon: "Flower2", repeatable: false, description: "Penutup & footer" },
  { type: "custom", labelKey: "common.add", icon: "Code2", repeatable: true, description: "Blok HTML kustom (disanitasi)" },
] as const;

export function sectionDefinition(type: SectionType): SectionDefinition {
  return SECTION_LIBRARY.find((item) => item.type === type) ?? (SECTION_LIBRARY[0] as SectionDefinition);
}

let counter = 0;
export function sectionId(type: SectionType): string {
  counter += 1;
  return `sec_${type}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function defaultEventSettings(title: string): EventSettings {
  return {
    pic: {
      name: "Rani Wulandari",
      phone: "081234567890",
      role: "Narahubung Acara",
      label: "PIC",
      showOnCover: true,
      showInContact: true,
      coverPosition: "bottom",
      format: "whatsapp",
      prefillMessage: "Assalamu'alaikum, saya menerima undangan {acara}. Boleh minta informasinya?",
      useForRsvpConfirmation: true,
    },
    bride: { name: "Siti", fullName: "Siti Aisyah Rahmawati", parentNames: "Bpk. H. Abdul Rahman & Ibu Hj. Maryam" },
    groom: { name: "Andi", fullName: "Andi Prasetyo Nugroho", parentNames: "Bpk. Bambang Sutrisno & Ibu Sri Wahyuni" },
    openingQuote: "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri.",
    coverSubtitle: "Dengan hormat, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.",
    loveStory: [
      { year: "2018", title: "Pertama Bertemu", description: "Di sebuah seminar kampus yang tak sengaja mempertemukan kami." },
      { year: "2021", title: "Menjadi Kami", description: "Perjalanan panjang yang diawali obrolan sederhana." },
      { year: "2026", title: "Lamaran", description: "Keluarga besar berkumpul, dan semuanya menjadi resmi." },
    ],
    gallery: [],
    livestream: [],
    quotes: [{ text: "Cinta yang tumbuh dari doa akan berakar pada ridha.", source: "— Keluarga" }],
    dressCode: { title: "Dress Code", description: "Busana semi-formal dengan nuansa earth tone.", swatches: ["#9A7B4F", "#E6DCCB", "#3E3A35", "#C9A961"] },
    gift: {
      accounts: [
        { id: "acc-1", label: "Rekening Bersama", bank: "BCA", number: "1234567890", holder: "Siti Aisyah", kind: "bank" },
        { id: "acc-2", label: "GoPay", bank: "GoPay", number: "081234567890", holder: "Andi Prasetyo", kind: "ewallet" },
      ],
      shippingAddress: "Jl. Melati No. 12, Surabaya, Jawa Timur",
      note: "Kehadiran dan doa Anda sudah lebih dari cukup.",
    },
    health: { title: "Protokol Kesehatan", items: ["Menjaga kebersihan tangan", "Menggunakan masker bila diperlukan", "Mengikuti arahan panitia di lokasi"] },
    turutMengundang: ["Keluarga Besar Bpk. H. Abdul Rahman", "Keluarga Besar Bpk. Bambang Sutrisno"],
    faq: [
      { question: "Apakah boleh membawa anak?", answer: "Tentu, mohon cantumkan jumlah pax pada form RSVP." },
      { question: "Dimana lokasi parkir?", answer: "Area parkir tersedia di sisi timur gedung, petugas akan mengarahkan." },
    ],
    rundown: [
      { time: "08.00", agenda: "Penyambutan tamu" },
      { time: "09.00", agenda: "Akad nikah" },
      { time: "11.00", agenda: "Resepsi & ramah tamah" },
    ],
    contacts: [],
    footer: { text: "Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir.", showBranding: true },
    wishesModerated: true,
    languages: ["id", "en"],
    metaTitle: title,
    metaDescription: `Undangan ${title} — konfirmasi kehadiran dan detail acara.`,
    pixelIds: {},
    noindex: true,
  };
}

export function defaultSections(): SectionConfig[] {
  const types: SectionType[] = [
    "cover", "couple", "saveDate", "schedule", "loveStory", "gallery", "quotes",
    "dressCode", "gift", "rsvp", "wishes", "contact", "footer",
  ];
  return types.map((type) => ({ id: sectionId(type), type, visible: true, data: {} }));
}

export function parseSections(raw: unknown): SectionConfig[] {
  if (!Array.isArray(raw)) return defaultSections();
  const parsed: SectionConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<SectionConfig>;
    if (typeof candidate.id !== "string" || typeof candidate.type !== "string") continue;
    parsed.push({
      id: candidate.id,
      type: candidate.type as SectionType,
      visible: candidate.visible !== false,
      title: candidate.title,
      data: (candidate.data && typeof candidate.data === "object" ? candidate.data : {}) as JsonObject,
    });
  }
  return parsed.length > 0 ? parsed : defaultSections();
}

export function parseSettings(raw: unknown, title: string): EventSettings {
  const base = defaultEventSettings(title);
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<EventSettings>;
  return {
    ...base,
    ...input,
    pic: { ...base.pic, ...(input.pic ?? {}) },
    bride: { ...base.bride, ...(input.bride ?? {}) },
    groom: { ...base.groom, ...(input.groom ?? {}) },
    gift: { ...base.gift, ...(input.gift ?? {}) },
    dressCode: { ...base.dressCode, ...(input.dressCode ?? {}) },
    footer: { ...base.footer, ...(input.footer ?? {}) },
    health: { ...base.health, ...(input.health ?? {}) },
  };
}

export function settingsToJson(settings: EventSettings): JsonObject {
  return JSON.parse(JSON.stringify(settings)) as JsonObject;
}

export function sectionsToJson(sections: SectionConfig[]): JsonObject {
  return JSON.parse(JSON.stringify(sections)) as unknown as JsonObject;
}
