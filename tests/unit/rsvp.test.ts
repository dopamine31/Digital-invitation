import { describe, expect, it } from "vitest";
import { defaultRsvpForm, isRsvpOpen, validatePaxQuota, validateRsvpSubmission, visibleFields } from "@/lib/rsvp";

const validAnswers = {
  dietary: "regular",
  relation: "teman",
  accommodation: false,
  message: "Selamat ya!",
};

describe("logika RSVP", () => {
  it("menerima submission hadir dengan jawaban wajib & consent", () => {
    const form = defaultRsvpForm();
    const result = validateRsvpSubmission(form, {
      status: "ATTENDING", pax: 2, answers: validAnswers, consent: true, website: "",
    }, 4, new Date("2026-11-13T00:00:00Z"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ATTENDING");
      expect(result.data.pax).toBe(2);
      expect(result.data.answers.relation).toBe("teman");
    }
  });

  it("menolak kuota pax di atas alokasi tamu", () => {
    expect(validatePaxQuota({ paxQuotaPerGuest: 4, paxAllocated: 2, maxPax: 10, requestedPax: 3 })).toMatchObject({ valid: false, effective: 2 });
    expect(validatePaxQuota({ paxQuotaPerGuest: 4, paxAllocated: 2, maxPax: 10, requestedPax: 2 }).valid).toBe(true);
  });

  it("menolak bot honeypot dan consent kosong", () => {
    const form = defaultRsvpForm();
    const bot = validateRsvpSubmission(form, { status: "ATTENDING", pax: 1, answers: validAnswers, consent: true, website: "spam" }, 4);
    const noConsent = validateRsvpSubmission(form, { status: "ATTENDING", pax: 1, answers: validAnswers, consent: false, website: "" }, 4);
    expect(bot.success).toBe(false);
    expect(noConsent.success).toBe(false);
  });

  it("conditional logic menyembunyikan field saat syarat tidak terpenuhi", () => {
    const form = defaultRsvpForm();
    const hidden = visibleFields(form.fields, { relation: "rekan-kerja" });
    const shown = visibleFields(form.fields, { relation: "keluarga" });
    expect(hidden.some((field) => field.id === "accommodation")).toBe(false);
    expect(shown.some((field) => field.id === "accommodation")).toBe(true);
  });

  it("deadline dan isClosed menutup form", () => {
    const form = defaultRsvpForm();
    form.deadlineAt = "2026-01-01T00:00:00.000Z";
    expect(isRsvpOpen(form, new Date("2026-11-13T00:00:00Z"))).toBe(false);
    form.deadlineAt = null;
    form.isClosed = true;
    expect(isRsvpOpen(form)).toBe(false);
  });
});
