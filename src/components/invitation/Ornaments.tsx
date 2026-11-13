import type { OrnKind } from "@/types";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function petal(n: number, cx: number, cy: number, r: number) {
  return Array.from({ length: n }, (_, i) => (
    <ellipse key={i} cx={cx} cy={cy - r} rx={r * 0.45} ry={r} transform={`rotate(${(360 / n) * i} ${cx} ${cy})`} {...S} fill="currentColor" fillOpacity={0.12} />
  ));
}
const star8 = (cx: number, cy: number, r: number) => (
  <g {...S}>
    <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
    <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} transform={`rotate(45 ${cx} ${cy})`} />
    <circle cx={cx} cy={cy} r={r * 0.35} />
  </g>
);
const spark = (x: number, y: number, r: number) => <path key={`${x}${y}`} d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} fill="currentColor" fillOpacity={0.7} />;

function motif(kind: OrnKind) {
  switch (kind) {
    case "floral": return (<g>
      {petal(7, 34, 34, 14)}<circle cx={34} cy={34} r={4} fill="currentColor" />
      {petal(6, 78, 18, 8)}{petal(6, 16, 80, 8)}
      <path d="M44 44Q70 52 96 30M44 44Q52 70 30 96" {...S} />
      <path d="M62 49q6-12 16-8q-4 10-16 8zM48 66q-12 6-8 16q10-4 8-16z" {...S} fill="currentColor" fillOpacity={0.2} />
    </g>);
    case "leaf": return (<g>
      <path d="M4 4Q50 20 110 8M4 4Q20 50 8 110" {...S} />
      {[24, 46, 68, 90].map((x, i) => <path key={i} d={`M${x} ${6 + i * 3}q10 22 28 22q-6-20-28-22z`} {...S} fill="currentColor" fillOpacity={0.18} />)}
      {[24, 46, 68, 90].map((y, i) => <path key={"b" + i} d={`M${6 + i * 3} ${y}q22 10 22 28q-20-6-22-28z`} {...S} fill="currentColor" fillOpacity={0.18} />)}
    </g>);
    case "geo": return (<g {...S}>{[100, 76, 52, 28].map((r) => <path key={r} d={`M0 ${r}A${r} ${r} 0 0 0 ${r} 0`} />)}<path d="M0 0L90 90M0 0L60 100M0 0L100 60" strokeOpacity={0.4} /></g>);
    case "islamic": return (<g>{star8(34, 34, 22)}{star8(86, 14, 9)}{star8(14, 86, 9)}<path d="M56 34H120M34 56V120" {...S} strokeOpacity={0.5} /></g>);
    case "batik": return (<g {...S}>{[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (r + c <= 3 ? <g key={`${r}${c}`} transform={`translate(${c * 34 + 4} ${r * 34 + 4})`}>
      <ellipse cx={15} cy={15} rx={7} ry={14} /><ellipse cx={15} cy={15} rx={14} ry={7} /><circle cx={15} cy={15} r={2} fill="currentColor" /></g> : null)))}</g>);
    case "wave": return (<g {...S}>{[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${22 + i * 16}q15-12 30 0t30 0t30 0t30 0`} strokeOpacity={1 - i * 0.2} />)}</g>);
    case "marble": return (<g {...S} strokeWidth={0.9}><path d="M0 20Q30 30 40 60T80 80T120 70" /><path d="M10 0Q20 40 50 50T70 100" strokeOpacity={0.6} /><path d="M0 60Q20 55 25 85T40 120" strokeOpacity={0.5} /><path d="M40 0Q60 20 100 25" strokeOpacity={0.4} /></g>);
    case "line": return (<g {...S}><path d="M8 80V8H80" /><path d="M20 80V20H80" strokeOpacity={0.4} /></g>);
    case "dots": return (<g fill="currentColor">{[0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3, 4].map((c) => (r + c < 5 ? <circle key={`${r}${c}`} cx={10 + c * 18} cy={10 + r * 18} r={3.4 - (r + c) * 0.5} /> : null)))}</g>);
    case "gold": return (<g {...S}><path d="M6 6C40 6 70 30 70 70" /><path d="M6 6C6 40 30 70 70 70" strokeOpacity={0.55} /><path d="M20 20C30 12 44 18 40 30S24 36 20 20z" fill="currentColor" fillOpacity={0.25} /><path d="M70 70q14 4 18 16T110 90" /><circle cx={70} cy={70} r={3} fill="currentColor" /><path d="M6 6h40M6 6v40" /></g>);
    case "stars": return (<g>{spark(20, 20, 14)}{spark(60, 14, 7)}{spark(14, 62, 7)}{spark(52, 48, 5)}{spark(92, 30, 4)}{spark(30, 96, 4)}</g>);
    default: return null;
  }
}

export function Orn({ kind, className = "", flip = false }: { kind: OrnKind; className?: string; flip?: boolean }) {
  if (kind === "none") return null;
  return (
    <svg aria-hidden viewBox="0 0 120 120" className={`pointer-events-none select-none ${className}`} style={{ color: "var(--accent)", transform: flip ? "rotate(180deg)" : undefined }}>
      {motif(kind)}
    </svg>
  );
}

export function Divider({ kind }: { kind: OrnKind }) {
  const common = { stroke: "currentColor", strokeWidth: 1.2, fill: "none", strokeLinecap: "round" as const };
  let mid: React.ReactNode = <circle cx={100} cy={10} r={3} fill="currentColor" />;
  if (kind === "floral" || kind === "leaf") mid = <g>{petal(6, 100, 10, 6)}<circle cx={100} cy={10} r={1.8} fill="currentColor" /></g>;
  if (kind === "islamic" || kind === "geo") mid = <g>{star8(100, 10, 6)}</g>;
  if (kind === "stars") mid = <g>{spark(100, 10, 8)}</g>;
  if (kind === "wave") mid = <path d="M80 10q5-8 10 0t10 0t10 0t10 0" {...common} />;
  if (kind === "none" || kind === "line") mid = <rect x={97} y={7} width={6} height={6} transform="rotate(45 100 10)" fill="currentColor" />;
  return (
    <svg aria-hidden viewBox="0 0 200 20" className="mx-auto my-5 h-5 w-48" style={{ color: "var(--accent)" }}>
      <path d="M10 10H88M112 10H190" {...common} strokeOpacity={0.7} />
      {mid}
    </svg>
  );
}
