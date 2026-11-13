import { describe, expect, it } from "vitest";
import { buildICS, parseCSV, sanitize, slugify, toCSV, normalizePhone, youtubeEmbed, isSafeUrl } from "@/lib/format";

describe("format utils", () => {
  it("slugify", () => { expect(slugify("Andi & Siti!")).toBe("andi-siti"); expect(slugify("")).toBe("undangan"); });
  it("sanitize menghapus tag HTML", () => { expect(sanitize("<b>Halo</b><script>x</script>")).toBe("Halox"); });
  it("parse CSV dengan kutip & delimiter titik koma", () => {
    expect(parseCSV('nama,telepon\n"Budi, S.",0812\n')).toEqual([["nama", "telepon"], ["Budi, S.", "0812"]]);
    expect(parseCSV("a;b\nc;d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("toCSV mencegah formula injection", () => { expect(toCSV([["=CMD()", "ok"]])).toBe("'=CMD(),ok"); });
  it("normalisasi nomor telepon", () => { expect(normalizePhone("0812-3456")).toBe("628123456"); expect(normalizePhone("+62 812")).toBe("62812"); });
  it("ICS valid", () => {
    const ics = buildICS({ title: "Akad", start: "2026-12-01T08:00", location: "Jakarta" });
    expect(ics).toContain("BEGIN:VEVENT"); expect(ics).toContain("DTSTART;TZID=Asia/Jakarta:20261201T080000"); expect(ics).toContain("SUMMARY:Akad");
  });
  it("embed YouTube & URL aman", () => {
    expect(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(isSafeUrl("javascript:alert(1)")).toBe(false); expect(isSafeUrl("https://a.b")).toBe(true);
  });
});
