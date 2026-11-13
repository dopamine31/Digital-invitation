export const idr = (n: number | null | undefined) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n ?? 0));

const TZ = "Asia/Jakarta";
export const dateID = (d: Date | string | null | undefined, withTime = false) => {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ, day: "numeric", month: "long", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};
export const dateLongID = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
};
export const timeAgo = (d: Date | string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} hari lalu`;
  return dateID(d);
};

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "undangan";

export const randomCode = (len = 8) => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(len);
  globalThis.crypto.getRandomValues(arr);
  for (const n of arr) out += chars[n % chars.length];
  return out;
};

/** Hapus tag HTML & karakter kontrol; batasi panjang. React sudah meng-escape output, ini lapisan tambahan. */
export const sanitize = (s: unknown, max = 500) =>
  String(s ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

export const normalizePhone = (p: string) => {
  const d = (p || "").replace(/[^0-9]/g, "");
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("62")) return d;
  return d ? "62" + d : "";
};
export const waLink = (phone: string, text: string) =>
  `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;

/* ---------- CSV ---------- */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  const src = text.replace(/^\uFEFF/, "");
  const delim = (src.split("\n")[0] || "").includes(";") && !(src.split("\n")[0] || "").includes(",") ? ";" : ",";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}
export function toCSV(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((v) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s; // cegah CSV/formula injection
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
}

/* ---------- Kalender ---------- */
const icsDate = (iso: string) => iso.replace(/[-:]/g, "").slice(0, 15).padEnd(15, "0");
export function buildICS(o: { title: string; start: string; end?: string; location?: string; description?: string }) {
  const start = icsDate(o.start.length === 10 ? o.start + "T090000" : o.start + (o.start.length === 16 ? ":00" : ""));
  const endIso = o.end || new Date(new Date(o.start).getTime() + 3 * 3600_000).toISOString().slice(0, 19);
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Digital Invitation Studio//ID", "BEGIN:VEVENT",
    `UID:${start}-${Math.abs(hash(o.title))}@invitation-studio`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Jakarta:${start}`, `DTEND;TZID=Asia/Jakarta:${icsDate(endIso)}`,
    `SUMMARY:${esc(o.title)}`, `LOCATION:${esc(o.location || "")}`, `DESCRIPTION:${esc(o.description || "")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
export function googleCalendarUrl(o: { title: string; start: string; end?: string; location?: string; description?: string }) {
  const s = icsDate(o.start.length === 10 ? o.start + "T090000" : o.start + ":00");
  const e = icsDate(o.end || new Date(new Date(o.start).getTime() + 3 * 3600_000).toISOString().slice(0, 19));
  const p = new URLSearchParams({ action: "TEMPLATE", text: o.title, dates: `${s}/${e}`, ctz: "Asia/Jakarta", location: o.location || "", details: o.description || "" });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

export const youtubeEmbed = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : "";
};
export const isSafeUrl = (u: string) => /^(https?:\/\/|\/|data:image\/|data:audio\/)/i.test(u.trim());
