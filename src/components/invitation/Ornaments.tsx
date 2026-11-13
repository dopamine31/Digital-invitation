import type { ThemeDefinition } from "@/lib/themes";

export function Ornament({ kind, className }: { kind: ThemeDefinition["ornament"]; className?: string }) {
  const common = { className, "aria-hidden": true, width: "100%", height: 56, viewBox: "0 0 320 56", fill: "none" } as const;
  switch (kind) {
    case "flourish":
      return <svg {...common}><path d="M10 28h90M220 28h90M160 8c-18 0-30 10-30 20s12 20 30 20 30-10 30-20-12-20-30-20Z" stroke="currentColor" strokeWidth="1" /><path d="M136 28c8-14 16-14 24 0 8 14 16 14 24 0" stroke="currentColor" strokeWidth="1" /><circle cx="160" cy="28" r="3" fill="currentColor" /></svg>;
    case "hairline":
      return <svg {...common}><path d="M0 28h320M0 20h60M260 20h60" stroke="currentColor" strokeWidth="1" /><rect x="150" y="22" width="20" height="12" stroke="currentColor" /></svg>;
    case "botanical":
      return <svg {...common}><path d="M160 50V12M160 30c-22-4-30-16-32-26 18 0 30 10 32 26Zm0 6c22-4 30-16 32-26-18 0-30 10-32 26Z" stroke="currentColor" strokeWidth="1.2" /><path d="M20 28q30-26 60 0M240 28q30-26 60 0" stroke="currentColor" strokeWidth="1" /><circle cx="160" cy="12" r="3" fill="currentColor" /></svg>;
    case "batik":
      return <svg {...common}><path d="M0 28q20-28 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="currentColor" strokeWidth="2" /><path d="M0 48q20-28 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="currentColor" strokeWidth="1" opacity=".5" /><path d="M0 8q20 28 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke="currentColor" strokeWidth="1" opacity=".5" /></svg>;
    case "arch":
      return <svg {...common}><path d="M110 50V26a50 50 0 0 1 100 0v24" stroke="currentColor" strokeWidth="1.5" /><path d="M128 50V27a32 32 0 0 1 64 0v23" stroke="currentColor" strokeWidth="1" /><path d="M0 50h110M210 50h110" stroke="currentColor" strokeWidth="1" /><path d="M160 8l6 10-6 10-6-10 6-10Z" fill="currentColor" /></svg>;
    case "doodle":
      return <svg {...common}><path d="M8 30c30-22 48 16 76-2s44 18 72-2 46 16 76-2 44 16 80-2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 5" /><path d="M148 34q12-20 24 0M160 34v12" stroke="currentColor" strokeWidth="1.2" /></svg>;
    case "numeral":
      return <svg {...common}><text x="20" y="44" fontFamily="Georgia,serif" fontSize="42" fill="currentColor" opacity=".16">01</text><path d="M110 28h200" stroke="currentColor" strokeWidth="2" /></svg>;
    case "deco":
      return <svg {...common}><path d="M0 28h120M200 28h120M160 2l16 26-16 26-16-26 16-26Z" stroke="currentColor" strokeWidth="1" /><path d="M138 28h44M160 14v28" stroke="currentColor" strokeWidth="1" /><path d="M20 20v16M30 20v16M290 20v16M300 20v16" stroke="currentColor" strokeWidth="1" /></svg>;
    default:
      return null;
  }
}

export function CoverFrame({ children, layout }: { children: React.ReactNode; layout: string }) {
  if (layout === "botanical-arch") return <div style={{ borderRadius: "260px 260px 12px 12px", border: "2px solid var(--inv-border)", overflow: "hidden" }}>{children}</div>;
  if (layout === "arch-geometric") return <div style={{ borderRadius: "50% 50% 8px 8px / 22% 22% 8px 8px", border: "2px solid var(--inv-accent)", overflow: "hidden" }}>{children}</div>;
  return <>{children}</>;
}
