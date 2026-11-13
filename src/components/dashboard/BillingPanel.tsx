"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Check, Sparkles } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { toast, CopyButton } from "@/components/client-ui";
import { createCheckoutAction, confirmMockPaymentAction, validateCouponAction } from "@/server/actions/billing";
import { parseLimits, parseFeatures } from "@/lib/billing";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { BillingData } from "@/server/queries";

export function BillingPanel({ data }: { data: BillingData }) {
  const router = useRouter();
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState("");

  const checkout = async (planId: string) => {
    setBusy(planId);
    const result = await createCheckoutAction({ planId, cycle, couponCode: coupon || undefined });
    setBusy("");
    if (!result.ok) { toast(result.error, "err"); return; }
    const paid = await confirmMockPaymentAction(result.data.invoiceId);
    if (!paid.ok) { toast(paid.error, "err"); return; }
    toast(`Pembayaran mock berhasil · ${formatCurrency(result.data.total)}`);
    router.refresh();
  };
  const validate = async (planId: string) => {
    if (!coupon) return;
    const result = await validateCouponAction(coupon, planId);
    if (!result.ok) { toast(result.error, "err"); setDiscount(0); return; }
    setDiscount(result.data.discount); toast(`Kupon berlaku · potongan ${formatCurrency(result.data.discount)}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Langganan & tagihan</h1><p className="page-subtitle">Upgrade/downgrade, kuota, faktur, transaksi, kupon, referral, masa aktif & grace period.</p></div>
        <div className="row"><Button size="sm" variant={cycle === "MONTHLY" ? "primary" : "default"} onClick={() => setCycle("MONTHLY")}>Bulanan</Button><Button size="sm" variant={cycle === "YEARLY" ? "primary" : "default"} onClick={() => setCycle("YEARLY")}>Tahunan · hemat</Button></div>
      </div>

      {data.subscription ? (
        <div className="notice notice-success row"><CreditCard size={18} /><span style={{ flex: 1 }}>Langganan <strong>{data.subscription.status}</strong> · siklus {data.subscription.billingCycle} · aktif sampai {formatDateTime(data.subscription.currentPeriodEnd)}{data.subscription.graceUntil ? ` · grace sampai ${formatDateTime(data.subscription.graceUntil)}` : ""}</span></div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: 22 }}>
        {data.plans.map((plan) => {
          const limits = parseLimits(plan.limits);
          const features = parseFeatures(plan.features);
          const active = data.plan?.id === plan.id;
          return (
            <div className="card card-hover" key={plan.id} style={{ borderColor: active ? "var(--ui-primary)" : undefined }}>
              <div className="row-between"><strong>{plan.name}</strong>{active ? <Badge tone="success">Paket aktif</Badge> : <Badge tone="primary">{plan.code}</Badge>}</div>
              <div style={{ fontFamily: "var(--ui-font-display)", fontSize: 30, margin: "12px 0" }}>{formatCurrency(cycle === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice)}<span className="small muted"> /{cycle === "MONTHLY" ? "bulan" : "tahun"}</span></div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="small">✓ {limits.maxEvents} acara · {limits.maxGuestsPerEvent} tamu/acara</span>
                <span className="small">✓ {limits.maxBlastsPerMonth} blast/bulan · {limits.seats} kursi tim</span>
                {Object.entries(features).filter(([, enabled]) => enabled).map(([key]) => <span className="tiny muted" key={key}>✓ {key}</span>)}
              </div>
              <div className="row" style={{ marginTop: 18 }}><input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Kode kupon" aria-label="Kode kupon" /><Button size="sm" onClick={() => validate(plan.id)}>Cek</Button></div>
              {discount > 0 ? <div className="tiny" style={{ color: "var(--ui-success)", marginTop: 6 }}>Potongan {formatCurrency(discount)}</div> : null}
              <Button variant={active ? "default" : "primary"} disabled={active || busy === plan.id} onClick={() => checkout(plan.id)} style={{ width: "100%", marginTop: 14 }}>
                {busy === plan.id ? <span className="spinner" /> : active ? <Check size={15} /> : <Sparkles size={15} />} {active ? "Sedang digunakan" : "Pilih & bayar mock"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Kuota & referral</h3>
          <div className="stack" style={{ marginTop: 14 }}>
            <div className="row-between small"><span className="muted">Acara terpakai</span><strong>{data.quota.events}</strong></div>
            <div className="row-between small"><span className="muted">Tamu terpakai</span><strong>{data.quota.guests}</strong></div>
            <div className="row-between small"><span className="muted">Blast bulan ini</span><strong>{data.quota.blasts}</strong></div>
            <div className="divider" />
            <div className="row-between"><span className="small">Kode referral</span><div className="row"><code className="mono">{data.referralCode ?? "Belum ada"}</code>{data.referralCode ? <CopyButton value={data.referralCode} label="Salin" /> : null}</div></div>
          </div>
        </div>
        <div className="card">
          <h3>Faktur terbaru</h3>
          {data.invoices.length === 0 ? <p className="small muted" style={{ marginTop: 12 }}>Belum ada faktur.</p> : (
            <div className="table-wrap" style={{ border: 0, marginTop: 12 }}><table className="table"><thead><tr><th>Nomor</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>
              {data.invoices.slice(0, 8).map((invoice) => <tr key={invoice.id}><td className="mono tiny">{invoice.number}</td><td>{formatCurrency(invoice.total)}</td><td><Badge tone={invoice.status === "PAID" ? "success" : "warn"}>{invoice.status}</Badge></td><td className="tiny muted">{formatDateTime(invoice.issuedAt)}</td></tr>)}
            </tbody></table></div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Transaksi</h3>
        {data.transactions.length === 0 ? <p className="small muted" style={{ marginTop: 12 }}>Belum ada transaksi.</p> : (
          <div className="table-wrap" style={{ border: 0, marginTop: 12 }}><table className="table"><thead><tr><th>ID</th><th>Provider</th><th>Jumlah</th><th>Status</th><th>Waktu</th></tr></thead><tbody>
            {data.transactions.slice(0, 10).map((row) => <tr key={row.id}><td className="mono tiny">{row.id.slice(0, 12)}</td><td>{row.provider}</td><td>{formatCurrency(row.amount)}</td><td><Badge tone="success">{row.status}</Badge></td><td className="tiny muted">{formatDateTime(row.createdAt)}</td></tr>)}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}
