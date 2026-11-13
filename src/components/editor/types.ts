import type { Design, InvitationData, SectionItem, TemplateConfig } from "@/types";
import type { Ent } from "@/lib/entitlements";

export type EState = {
  title: string; slug: string; password: string; publishAt: string; expireAt: string;
  data: InvitationData; design: Design; sections: SectionItem[];
};
export type Updater = (fn: (s: EState) => EState, key?: string) => void;
export type PanelProps = { s: EState; up: Updater; ent: Ent; baseCfg: TemplateConfig; defaults: InvitationData; maxPhotos: number };

export const FONT_CHOICES = ["Playfair Display", "Cormorant Garamond", "Lora", "Libre Baskerville", "EB Garamond", "Cinzel", "Marcellus", "DM Serif Display", "Fraunces", "Abril Fatface", "Bebas Neue",
  "Jost", "Nunito", "Raleway", "Quicksand", "Inter", "Space Grotesk", "Josefin Sans", "Syne", "Amiri",
  "Great Vibes", "Dancing Script", "Allura", "Pinyon Script", "Parisienne", "Sacramento", "Satisfy", "Caveat", "Tangerine", "Scheherazade New"];
