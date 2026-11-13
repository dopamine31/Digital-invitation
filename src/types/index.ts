export type Role = "owner" | "staff" | "customer";
export type Tier = "free" | "basic" | "premium" | "exclusive";

export type Palette = { bg: string; surface: string; text: string; muted: string; accent: string; accent2: string };

export type CoverKind = "center" | "split" | "frame" | "arch" | "stack" | "type" | "full" | "circle";
export type OrnKind = "floral" | "leaf" | "geo" | "islamic" | "batik" | "wave" | "marble" | "line" | "dots" | "gold" | "stars" | "none";
export type GalleryKind = "grid" | "masonry" | "polaroid" | "slider" | "film" | "mosaic";
export type AnimKind = "fade" | "rise" | "zoom" | "blur" | "slide" | "flip";
export type BtnKind = "pill" | "square" | "outline" | "underline" | "soft";
export type EventKind = "cards" | "timeline" | "split" | "ticket";

export type TemplateConfig = {
  pal: Palette;
  head: string; // font heading
  body: string; // font body
  script: string; // font aksen / nama
  cover: CoverKind;
  orn: OrnKind;
  gal: GalleryKind;
  anim: AnimKind;
  btn: BtnKind;
  ev: EventKind;
  dark: boolean;
  rad: number; // radius px
};

export type Host = { name: string; fullName: string; parents: string; bio: string; photo: string };
export type EventItem = { name: string; date: string; time: string; endTime: string; place: string; address: string; mapUrl: string; note: string };
export type StoryItem = { date: string; title: string; text: string; photo: string };
export type GiftItem = { type: "bank" | "ewallet" | "qris"; provider: string; number: string; holder: string; qr: string };

export type InvitationData = {
  eventType: string;
  heading: string;
  opening: string;
  host1: Host;
  host2: Host;
  date: string; // ISO local "YYYY-MM-DDTHH:mm"
  coverPhoto: string;
  events: EventItem[];
  story: StoryItem[];
  gallery: string[];
  videoUrl: string;
  videoPoster: string;
  streamUrl: string;
  streamPlatform: string;
  streamSchedule: string;
  locationName: string;
  address: string;
  mapUrl: string;
  mapEmbed: string;
  directions: string;
  gifts: GiftItem[];
  giftAddress: string;
  musicUrl: string;
  musicTitle: string;
  rsvpDeadline: string;
  closing: string;
  family: string;
  footerText: string;
};

export type SectionItem = { key: string; enabled: boolean; custom?: { title: string; body: string } };
export type Design = Partial<Omit<TemplateConfig, "pal">> & { pal?: Partial<Palette>; fontScale?: number; bgImage?: string; css?: string };

export type ActionResult = { ok: boolean; message: string; redirect?: string };

export const SECTION_LABELS: Record<string, string> = {
  cover: "Cover / Pembuka", intro: "Perkenalan", countdown: "Hitung Mundur", events: "Detail Acara",
  calendar: "Kalender", story: "Cerita", gallery: "Galeri", video: "Video", location: "Lokasi",
  rsvp: "RSVP", wishes: "Buku Tamu / Ucapan", gift: "Hadiah Digital", live: "Live Streaming",
  closing: "Penutup", footer: "Footer",
};
export const ALL_SECTIONS = Object.keys(SECTION_LABELS);
