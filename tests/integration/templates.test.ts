import { describe, expect, it } from "vitest";
import { TEMPLATE_SEEDS } from "@/templates/registry";

describe("registry template", () => {
  it("minimal 30 template dengan slug unik", () => {
    expect(TEMPLATE_SEEDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TEMPLATE_SEEDS.map((t) => t.slug)).size).toBe(TEMPLATE_SEEDS.length);
  });
  it("tidak ada dua template dengan kombinasi desain identik", () => {
    const sig = TEMPLATE_SEEDS.map(({ cfg: c }) => [c.cover, c.orn, c.gal, c.anim, c.btn, c.ev, c.head, c.script, c.pal.bg, c.pal.accent].join("|"));
    expect(new Set(sig).size).toBe(TEMPLATE_SEEDS.length);
  });
  it("variasi nyata pada tiap dimensi desain", () => {
    const dim = (k: "cover" | "orn" | "gal" | "anim" | "btn" | "ev") => new Set(TEMPLATE_SEEDS.map((t) => t.cfg[k])).size;
    expect(dim("cover")).toBe(8); expect(dim("gal")).toBe(6); expect(dim("anim")).toBe(6); expect(dim("btn")).toBe(5); expect(dim("ev")).toBe(4); expect(dim("orn")).toBeGreaterThanOrEqual(11);
    expect(new Set(TEMPLATE_SEEDS.map((t) => t.cfg.head)).size).toBeGreaterThanOrEqual(15);
  });
});
