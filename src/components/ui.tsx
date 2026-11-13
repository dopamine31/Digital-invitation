import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "default" | "ghost" | "danger";

export function Button({
  variant = "default", size = "md", className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "icon" }) {
  return (
    <button
      {...props}
      className={clsx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        size === "icon" && "btn-icon",
        className,
      )}
    />
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div {...props} className={clsx("card", className)}>{children}</div>;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warn" | "danger" | "primary" }) {
  return <span className={clsx("badge", tone === "success" && "badge-success", tone === "warn" && "badge-warn", tone === "danger" && "badge-danger", tone === "primary" && "badge-primary")}>{children}</span>;
}

export function StatCard({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon?: ReactNode }) {
  return (
    <Card className="card-hover">
      <div className="row-between">
        <span className="stat-label">{label}</span>
        {icon ? <span className="muted">{icon}</span> : null}
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="small muted" style={{ marginTop: 8 }}>{hint}</div> : null}
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 32, marginBottom: 10 }}>✦</div>
      <h3>{title}</h3>
      {description ? <p className="small muted" style={{ marginTop: 6 }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

export function Skeleton({ height = 18, width = "100%" }: { height?: number; width?: string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div>
      {label ? <div className="row-between small muted" style={{ marginBottom: 6 }}><span>{label}</span><span>{value} / {max}</span></div> : null}
      <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function BarChart({ data, height = 130 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div>
      <div className="chart" style={{ height }} role="img" aria-label={`Grafik ${data.length} titik data, nilai tertinggi ${max}`}>
        {data.map((item) => (
          <div key={item.label} className="chart-bar" style={{ height: `${Math.max(3, (item.value / max) * 100)}%` }} title={`${item.label}: ${item.value}`} />
        ))}
      </div>
      <div className="row-between tiny muted" style={{ marginTop: 7 }}>
        <span>{data[0]?.label ?? ""}</span><span>{data[data.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="row-between" style={{ marginBottom: 16 }}>
      <div><h3>{title}</h3>{description ? <p className="small muted" style={{ marginTop: 4 }}>{description}</p> : null}</div>
      {action}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="stack" style={{ gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} className="row-between" style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 9 }}>
          <dt className="small muted">{item.label}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
