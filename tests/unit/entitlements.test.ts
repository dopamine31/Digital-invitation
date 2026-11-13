import { describe, expect, it } from "vitest";
import { computeEnt, sectionAllowed, tierOk, DEFAULT_ENT } from "@/lib/entitlements";

describe("entitlements", () => {
  it("default paket tidak memberi fitur premium", () => {
    const e = computeEnt({});
    expect(e.personalized).toBe(false);
    expect(sectionAllowed("gift", e)).toBe(false);
    expect(sectionAllowed("wishes", e)).toBe(false);
    expect(sectionAllowed("rsvp", e)).toBe(true);
    expect(sectionAllowed("custom:abc", e)).toBe(false);
  });
  it("add-on menambah kuota & membuka fitur", () => {
    const e = computeEnt({ maxGuests: 100 }, [{ code: "a", entitlements: { maxGuests: 500, removeBranding: true } }]);
    expect(e.maxGuests).toBe(600);
    expect(e.removeBranding).toBe(true);
    expect(DEFAULT_ENT.removeBranding).toBe(false);
  });
  it("tier template vs paket", () => {
    expect(tierOk("premium", "basic")).toBe(false);
    expect(tierOk("premium", "exclusive")).toBe(true);
    expect(tierOk("free", "free")).toBe(true);
    expect(tierOk("exclusive", "custom")).toBe(true);
  });
});
