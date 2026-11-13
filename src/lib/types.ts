export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type Locale = "id" | "en";

export type SectionType =
  | "cover" | "couple" | "saveDate" | "schedule" | "loveStory" | "gallery"
  | "livestream" | "quotes" | "dressCode" | "gift" | "wishes" | "health"
  | "turutMengundang" | "faq" | "rundown" | "contact" | "rsvp" | "guestBook"
  | "footer" | "custom";

export interface SectionConfig {
  id: string;
  type: SectionType;
  visible: boolean;
  title?: string;
  data: JsonObject;
}

export interface PicConfig {
  name: string;
  phone: string;
  role: string;
  label: string;
  showOnCover: boolean;
  showInContact: boolean;
  coverPosition: "top" | "bottom" | "side";
  format: "whatsapp" | "national" | "international";
  prefillMessage: string;
  useForRsvpConfirmation: boolean;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  fonts: { display: string; body: string; displayUrl?: string; bodyUrl?: string };
  radius: number;
  spacing: number;
  borderWidth: number;
  background: {
    type: "solid" | "gradient" | "pattern" | "image";
    value: string;
    overlayOpacity: number;
  };
  music: {
    enabled: boolean;
    url: string;
    volume: number;
    fadeIn: number;
    fadeOut: number;
    trimStart: number;
    trimEnd: number;
  };
  animation: { enabled: boolean; reveal: boolean; parallax: boolean; coverOpening: boolean };
  customCss: string;
  customHtml: string;
  customHead: string;
}

export interface GiftAccount {
  id: string;
  label: string;
  bank: string;
  number: string;
  holder: string;
  kind: "bank" | "ewallet" | "qris";
  qrisUrl?: string;
  address?: string;
}

export interface EventSettings {
  pic: PicConfig;
  bride: { name: string; fullName: string; parentNames: string; photo?: string };
  groom: { name: string; fullName: string; parentNames: string; photo?: string };
  openingQuote: string;
  coverSubtitle: string;
  loveStory: { year: string; title: string; description: string }[];
  gallery: { url: string; caption: string; type: "image" | "video" }[];
  livestream: { platform: string; url: string; label: string }[];
  quotes: { text: string; source: string }[];
  dressCode: { title: string; description: string; swatches: string[] };
  gift: { accounts: GiftAccount[]; shippingAddress: string; note: string };
  health: { title: string; items: string[] };
  turutMengundang: string[];
  faq: { question: string; answer: string }[];
  rundown: { time: string; agenda: string }[];
  contacts: { name: string; role: string; phone: string }[];
  footer: { text: string; showBranding: boolean };
  wishesModerated: boolean;
  languages: Locale[];
  metaTitle: string;
  metaDescription: string;
  pixelIds: { facebook?: string; google?: string; tiktok?: string };
  noindex: boolean;
}

export interface EventRecord {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  themeId: string;
  themeConfig: JsonObject;
  sections: JsonObject;
  settings: JsonObject;
  meta: JsonObject;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  indexable: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuestRecord {
  id: string;
  tenantId: string;
  eventId: string;
  name: string;
  phoneEncrypted: string | null;
  phoneMasked: string | null;
  email: string | null;
  token: string;
  qrPayload: string;
  groupLabel: string;
  paxAllocated: number;
  paxConfirmed: number;
  blacklisted: boolean;
  optOut: boolean;
  walkIn: boolean;
  seatNumber: string | null;
  tableNumber: string | null;
  lastOpenedAt: Date | null;
}

export type RsvpFieldType =
  | "text" | "textarea" | "number" | "select" | "multiselect" | "radio"
  | "checkbox" | "date" | "phone" | "email" | "file" | "address";

export interface RsvpCondition {
  fieldId: string;
  operator: "equals" | "notEquals" | "contains" | "in";
  value: string | string[];
}

export interface RsvpField {
  id: string;
  type: RsvpFieldType;
  label: Record<Locale, string>;
  placeholder?: Record<Locale, string>;
  required: boolean;
  options?: { value: string; label: Record<Locale, string> }[];
  showIf?: RsvpCondition;
  min?: number;
  max?: number;
  pattern?: string;
  helpText?: string;
}

export interface RsvpFormConfig {
  fields: RsvpField[];
  deadlineAt: string | null;
  paxQuotaPerGuest: number;
  isClosed: boolean;
  thankYouMessage: string;
  redirectUrl: string | null;
  settings: {
    allowMaybe: boolean;
    allowSessionChoice: boolean;
    sessions: { id: string; label: string; time: string }[];
    mealChoices: string[];
    maxPax: number;
    requirePhone: boolean;
    autoCloseAtDeadline: boolean;
    locales: Locale[];
  };
  locales: Record<string, Record<string, string>>;
}

export interface PlanLimits {
  maxEvents: number;
  maxGuestsPerEvent: number;
  maxStorageMb: number;
  maxBlastsPerMonth: number;
  seats: number;
}

export interface PlanFeatures {
  customDomain: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  customFonts: boolean;
  customCss: boolean;
  removeBranding: boolean;
  livestream: boolean;
  offlineCheckin: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}
