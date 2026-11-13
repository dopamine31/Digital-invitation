import type { JsonObject, ThemeConfig } from "@/lib/types";

export type ThemeLayout =
  | "classic-frame" | "split-typographic" | "botanical-arch" | "batik-centered"
  | "arch-geometric" | "kraft-paper" | "editorial-grid" | "art-deco-dark";

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  layout: ThemeLayout;
  dark: boolean;
  ornament: "flourish" | "hairline" | "botanical" | "batik" | "arch" | "doodle" | "numeral" | "deco";
  fonts: { display: string; body: string; google: string };
  colors: ThemeConfig["colors"];
  background: ThemeConfig["background"];
  radius: number;
  spacing: number;
  borderWidth: number;
  sectionStyle: "centered" | "split" | "card" | "bordered" | "grid" | "torn" | "editorial" | "deco";
}

/**
 * 8 tema dengan struktur cover, ornament, tipografi, ritme section, dan
 * komposisi yang berbeda — bukan sekadar palet warna.
 */
export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "elegant-ivory", name: "Elegant Ivory", description: "Klasik bersih, bingkai tipis, aksen emas halus.",
    category: "Klasik", layout: "classic-frame", dark: false, ornament: "flourish",
    fonts: { display: "'Cormorant Garamond', Georgia, serif", body: "'Inter', system-ui, sans-serif", google: "Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600" },
    colors: { primary: "#9A7B4F", secondary: "#3E3A35", accent: "#C9A961", background: "#FBF8F2", surface: "#FFFFFF", text: "#2E2A25", muted: "#7A736A", border: "#E6DCCB" },
    background: { type: "solid", value: "#FBF8F2", overlayOpacity: 0 }, radius: 12, spacing: 1, borderWidth: 1, sectionStyle: "centered",
  },
  {
    id: "modern-minimal", name: "Modern Minimal", description: "Tipografi besar, grid split, tanpa ornamen.",
    category: "Modern", layout: "split-typographic", dark: false, ornament: "hairline",
    fonts: { display: "'Manrope', system-ui, sans-serif", body: "'Manrope', system-ui, sans-serif", google: "Manrope:wght@300;400;500;600;700;800" },
    colors: { primary: "#111111", secondary: "#5B5B5B", accent: "#D7FF3E", background: "#FFFFFF", surface: "#F5F5F5", text: "#0A0A0A", muted: "#6E6E6E", border: "#E2E2E2" },
    background: { type: "solid", value: "#FFFFFF", overlayOpacity: 0 }, radius: 2, spacing: 1.35, borderWidth: 1, sectionStyle: "split",
  },
  {
    id: "floral-botanical", name: "Floral Botanical", description: "Lengkungan botanis, ilustrasi daun, nuansa sage.",
    category: "Romantis", layout: "botanical-arch", dark: false, ornament: "botanical",
    fonts: { display: "'Playfair Display', Georgia, serif", body: "'Jost', system-ui, sans-serif", google: "Playfair+Display:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500" },
    colors: { primary: "#5C7052", secondary: "#8C6A5D", accent: "#D9A7A0", background: "#F4F1E8", surface: "#FFFCF6", text: "#384235", muted: "#7E8876", border: "#D9DFCF" },
    background: { type: "pattern", value: "botanical", overlayOpacity: 0.06 }, radius: 28, spacing: 1.1, borderWidth: 1, sectionStyle: "card",
  },
  {
    id: "adat-jawa", name: "Adat Jawa", description: "Pola batik parang, aksen emas, komposisi simetris.",
    category: "Tradisional", layout: "batik-centered", dark: false, ornament: "batik",
    fonts: { display: "'Cinzel', Georgia, serif", body: "'Noto Sans', system-ui, sans-serif", google: "Cinzel:wght@400;600;700&family=Noto+Sans:wght@300;400;500;600" },
    colors: { primary: "#6B3410", secondary: "#3B2415", accent: "#C99A3C", background: "#F3E6CE", surface: "#FBF1DC", text: "#38220F", muted: "#876D51", border: "#C9A86F" },
    background: { type: "pattern", value: "batik", overlayOpacity: 0.09 }, radius: 4, spacing: 1, borderWidth: 2, sectionStyle: "bordered",
  },
  {
    id: "islamic-green", name: "Islamic Green", description: "Mihrab geometris, emerald & emas, kaligrafi.",
    category: "Religius", layout: "arch-geometric", dark: false, ornament: "arch",
    fonts: { display: "'Amiri', Georgia, serif", body: "'Lato', system-ui, sans-serif", google: "Amiri:wght@400;700&family=Lato:wght@300;400;700" },
    colors: { primary: "#145A46", secondary: "#0C3B2E", accent: "#D4AF37", background: "#F2F7F2", surface: "#FFFFFF", text: "#17372C", muted: "#6F8A7D", border: "#C8DCCB" },
    background: { type: "gradient", value: "linear-gradient(160deg,#F2F7F2 0%,#DCEBDD 100%)", overlayOpacity: 0 }, radius: 18, spacing: 1.1, borderWidth: 1, sectionStyle: "centered",
  },
  {
    id: "rustic", name: "Rustic", description: "Kertas kraft, tepian robek, ilustrasi tangan.",
    category: "Rustic", layout: "kraft-paper", dark: false, ornament: "doodle",
    fonts: { display: "'Caveat', cursive", body: "'Nunito', system-ui, sans-serif", google: "Caveat:wght@400;600;700&family=Nunito:wght@300;400;600" },
    colors: { primary: "#A4593B", secondary: "#6C4A32", accent: "#D9A05B", background: "#EFE0C9", surface: "#F8EEDC", text: "#4A3527", muted: "#8E7A63", border: "#C9AE89" },
    background: { type: "pattern", value: "kraft", overlayOpacity: 0.12 }, radius: 6, spacing: 1.2, borderWidth: 1, sectionStyle: "torn",
  },
  {
    id: "bold-editorial", name: "Bold Editorial", description: "Grid majalah, angka raksasa, kontras merah.",
    category: "Editorial", layout: "editorial-grid", dark: false, ornament: "numeral",
    fonts: { display: "'Bodoni Moda', Georgia, serif", body: "'Space Grotesk', system-ui, sans-serif", google: "Bodoni+Moda:opsz,wght@6..96,400;6..96,700&family=Space+Grotesk:wght@300;400;500;700" },
    colors: { primary: "#D7263D", secondary: "#141414", accent: "#F6C445", background: "#F7F4EE", surface: "#FFFFFF", text: "#141414", muted: "#6B6B6B", border: "#1A1A1A" },
    background: { type: "solid", value: "#F7F4EE", overlayOpacity: 0 }, radius: 0, spacing: 1.5, borderWidth: 2, sectionStyle: "editorial",
  },
  {
    id: "luxe-gold-dark", name: "Luxe Gold Dark", description: "Art-deco gelap, garis emas, kesan eksklusif.",
    category: "Mewah", layout: "art-deco-dark", dark: true, ornament: "deco",
    fonts: { display: "'Italiana', Georgia, serif", body: "'Montserrat', system-ui, sans-serif", google: "Italiana&family=Montserrat:wght@300;400;500;600" },
    colors: { primary: "#D9B76A", secondary: "#F3EAD5", accent: "#B98F45", background: "#10151B", surface: "#182029", text: "#F3EAD5", muted: "#A8A79E", border: "#3C4340" },
    background: { type: "gradient", value: "radial-gradient(circle at 50% 0%,#1D2833 0%,#0C1015 70%)", overlayOpacity: 0 }, radius: 4, spacing: 1.25, borderWidth: 1, sectionStyle: "deco",
  },
] as const;

export const THEME_IDS = THEMES.map((theme) => theme.id);

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? (THEMES[0] as ThemeDefinition);
}

export function defaultThemeConfig(themeId = "elegant-ivory"): ThemeConfig {
  const theme = getTheme(themeId);
  return {
    colors: { ...theme.colors },
    fonts: { display: theme.fonts.display, body: theme.fonts.body },
    radius: theme.radius,
    spacing: theme.spacing,
    borderWidth: theme.borderWidth,
    background: { ...theme.background },
    music: { enabled: false, url: "", volume: 0.45, fadeIn: 2, fadeOut: 2, trimStart: 0, trimEnd: 0 },
    animation: { enabled: true, reveal: true, parallax: true, coverOpening: true },
    customCss: "",
    customHtml: "",
    customHead: "",
  };
}

export function mergeThemeConfig(themeId: string, partial: unknown): ThemeConfig {
  const base = defaultThemeConfig(themeId);
  if (!partial || typeof partial !== "object") return base;
  const input = partial as Partial<ThemeConfig>;
  return {
    ...base,
    ...input,
    colors: { ...base.colors, ...(input.colors ?? {}) },
    fonts: { ...base.fonts, ...(input.fonts ?? {}) },
    background: { ...base.background, ...(input.background ?? {}) },
    music: { ...base.music, ...(input.music ?? {}) },
    animation: { ...base.animation, ...(input.animation ?? {}) },
  };
}

/** CSS custom properties yang dipakai ThemeShell + seluruh section. */
export function themeCssVariables(config: ThemeConfig): Record<string, string> {
  return {
    "--inv-primary": config.colors.primary,
    "--inv-secondary": config.colors.secondary,
    "--inv-accent": config.colors.accent,
    "--inv-bg": config.colors.background,
    "--inv-surface": config.colors.surface,
    "--inv-text": config.colors.text,
    "--inv-muted": config.colors.muted,
    "--inv-border": config.colors.border,
    "--inv-font-display": config.fonts.display,
    "--inv-font-body": config.fonts.body,
    "--inv-radius": `${config.radius}px`,
    "--inv-spacing": String(config.spacing),
    "--inv-border-width": `${config.borderWidth}px`,
    "--inv-bg-value": config.background.type === "solid" || config.background.type === "gradient"
      ? config.background.value
      : config.colors.background,
    "--inv-overlay": String(config.background.overlayOpacity),
  } as Record<string, string>;
}

export function themeToJson(config: ThemeConfig): JsonObject {
  return JSON.parse(JSON.stringify(config)) as JsonObject;
}
