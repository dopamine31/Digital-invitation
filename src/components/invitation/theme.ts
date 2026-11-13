import type { Design, TemplateConfig } from "@/types";

export function mergeConfig(base: TemplateConfig, design?: Design): TemplateConfig {
  const d = design ?? {};
  const clean = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined && v !== "" && !["pal", "fontScale", "bgImage", "css"].includes(k)));
  return { ...base, ...clean, pal: { ...base.pal, ...(d.pal ?? {}) } } as TemplateConfig;
}

const VARIABLE = new Set(["Jost", "Lora", "Nunito", "Raleway", "Inter", "DM Sans", "Space Grotesk", "Quicksand", "Playfair Display", "Cormorant Garamond",
  "Fraunces", "Libre Baskerville", "EB Garamond", "Cinzel", "Syne", "Josefin Sans", "Noto Serif KR", "Noto Sans KR", "Noto Serif JP", "Noto Sans JP"]);

export function fontsHref(cfg: TemplateConfig, text?: string): string {
  const fams = Array.from(new Set([cfg.head, cfg.body, cfg.script].filter(Boolean)));
  const q = fams.map((f) => `family=${f.replace(/ /g, "+")}${VARIABLE.has(f) && !text ? ":wght@400;600" : ""}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;
}

export function onColor(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}

export function themeVars(cfg: TemplateConfig, fontScale = 1): React.CSSProperties {
  const p = cfg.pal;
  return {
    "--bg": p.bg, "--surface": p.surface, "--text": p.text, "--muted": p.muted, "--accent": p.accent, "--accent2": p.accent2,
    "--on-accent": onColor(p.accent), "--rad": `${cfg.rad}px`, "--fs": String(fontScale),
    "--f-head": `'${cfg.head}'`, "--f-body": `'${cfg.body}'`, "--f-script": `'${cfg.script}'`,
  } as React.CSSProperties;
}

export const INV_CSS = `
.inv{background:var(--bg);color:var(--text);font-family:var(--f-body),system-ui,sans-serif;font-size:calc(15px*var(--fs));line-height:1.65;overflow-x:hidden;position:relative}
.inv *{box-sizing:border-box}
.inv h1,.inv h2,.inv h3,.inv .hd{font-family:var(--f-head),Georgia,serif;font-weight:500;letter-spacing:.01em}
.inv .sc{font-family:var(--f-script),cursive;font-weight:400}
.inv .mut{color:var(--muted)}
.inv .acc{color:var(--accent)}
.inv .card{background:var(--surface);border-radius:var(--rad);border:1px solid color-mix(in srgb,var(--accent) 28%,transparent)}
.inv .rv{opacity:0}
.inv .rv.in{animation-duration:.9s;animation-fill-mode:both;animation-timing-function:cubic-bezier(.2,.7,.2,1)}
.inv[data-anim=fade] .rv.in{animation-name:i-fade}
.inv[data-anim=rise] .rv.in{animation-name:i-rise}
.inv[data-anim=zoom] .rv.in{animation-name:i-zoom}
.inv[data-anim=blur] .rv.in{animation-name:i-blur}
.inv[data-anim=slide] .rv.in{animation-name:i-slide}
.inv[data-anim=flip] .rv.in{animation-name:i-flip}
@keyframes i-fade{from{opacity:0}to{opacity:1}}
@keyframes i-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes i-zoom{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:none}}
@keyframes i-blur{from{opacity:0;filter:blur(12px)}to{opacity:1;filter:none}}
@keyframes i-slide{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}
@keyframes i-flip{from{opacity:0;transform:perspective(600px) rotateX(40deg)}to{opacity:1;transform:none}}
@keyframes i-spin{to{transform:rotate(360deg)}}
@keyframes i-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.inv .ib{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.7rem 1.4rem;font-size:.9em;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:transform .2s,opacity .2s;text-decoration:none;border:1.5px solid var(--accent);min-height:44px}
.inv .ib:hover{transform:translateY(-1px);opacity:.92}
.inv .ib:disabled{opacity:.5;cursor:not-allowed}
.inv[data-btn=pill] .ib{border-radius:999px;background:var(--accent);color:var(--on-accent)}
.inv[data-btn=square] .ib{border-radius:0;background:var(--accent);color:var(--on-accent);text-transform:uppercase;font-size:.78em}
.inv[data-btn=outline] .ib{border-radius:calc(var(--rad)/2);background:transparent;color:var(--accent)}
.inv[data-btn=underline] .ib{border:0;border-bottom:1.5px solid var(--accent);border-radius:0;background:transparent;color:var(--text);padding-left:.2rem;padding-right:.2rem}
.inv[data-btn=soft] .ib{border-radius:var(--rad);border-color:transparent;background:color-mix(in srgb,var(--accent) 18%,var(--surface));color:var(--text)}
.inv .ib.sm{padding:.45rem .9rem;min-height:36px;font-size:.8em}
.inv input,.inv select,.inv textarea{width:100%;background:var(--surface);color:var(--text);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-radius:calc(var(--rad)/2);padding:.7rem .9rem;font:inherit;font-size:16px;min-height:44px}
.inv input:focus,.inv select:focus,.inv textarea:focus{outline:2px solid var(--accent);outline-offset:1px}
.inv label{font-size:.8em;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);display:block;margin-bottom:.3rem;text-align:left}
.inv .hscroll{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:.75rem;scrollbar-width:none}
.inv .hscroll::-webkit-scrollbar{display:none}
.inv .hscroll>*{scroll-snap-align:center;flex:0 0 82%}
@media (prefers-reduced-motion:reduce){.inv .rv{opacity:1!important;animation:none!important}.inv .spin{animation:none!important}}
`;
