"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Ban, RotateCcw, UserRoundCog, Eye, Download, Trash2,
  Sparkles, Flag, Megaphone, Save, Settings2, KeyRound, Plus,
} from "lucide-react";
import { Button, Badge, EmptyState, Card } from "@/components/ui";
import { Tabs, Modal, toast, CopyButton } from "@/components/client-ui";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { parseLimits, parseFeatures } from "@/lib/billing";
import {
  setTenantStatusAction, changeTenantPlanAction, resetQuotaAction, impersonateTenantAction,
  savePlanAction, saveCouponAction, saveTemplateAction, resolveReportAction,
  saveAnnouncementAction, setFeatureFlagAction, setSystemSettingAction,
  gdprExportAction, gdprDeleteAction, createTenantUserAction, createPayoutAction,
  rotateSecretAction,
} from "@/server/actions/admin";
import type { Kpis } from "@/server/actions/admin";

export interface TenantRow {
  id: string; name: string; slug: string; status: string; planCode: string;
  createdAt: string; eventCount: number; guestCount: number; userEmail: string | null;
}
export interface PlanRow { id: string; code: string; name: string; monthlyPrice: number; yearlyPrice: number; trialDays: number; limits: unknown; features: unknown; isActive: boolean }
export interface TemplateRow { id: string; code: string; name: string; category: string; themeId: string; status: string; featured: boolean }
export interface ReportRow { id: string; reason: string; details: string; status: string; createdAt: string; reporterEmail: string | null }
export interface FlagRow { key: string; enabledGlobally: boolean }
export interface SettingRow { key: string; value: unknown }
export interface AnnouncementRow { id: string; title: string; body: string; active: boolean; publishedAt: string }

async function showResult(result: { ok: boolean; error?: string }, success: string, router: ReturnType<typeof useRouter>) {
  if (!result.ok) { toast(result.error ?? "Gagal", "err"); return; }
  toast(success); router.refresh();
}

export function TenantAdmin({ tenants, plans }: { tenants: TenantRow[]; plans: PlanRow[] }) {
  const router = useRouter();
  const [user, setUser] = useState<{ tenantId: string; name: string; email: string; password: string } | null>(null);
  const [gdpr, setGdpr] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Tenant</h1><p className="page-subtitle">Kelola status, paket, kuota, impersonate dengan audit, dan hak data UU PDP.</p></div><Badge tone="primary">{tenants.length} tenant</Badge></div>
      <div className="card">
        {tenants.length === 0 ? <EmptyState title="Belum ada tenant" description="Tenant dibuat otomatis saat pendaftaran." /> : (
          <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Tenant</th><th>Status</th><th>Paket</th><th>Penggunaan</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td><strong>{tenant.name}</strong><div className="tiny muted mono">/{tenant.slug} · {tenant.userEmail ?? "—"}</div></td>
                <td><Badge tone={tenant.status === "ACTIVE" ? "success" : tenant.status === "TRIAL" ? "primary" : "danger"}>{tenant.status}</Badge></td>
                <td><select className="select" value={plans.find((plan) => plan.code === tenant.planCode)?.id ?? ""} onChange={async (e) => showResult(await changeTenantPlanAction(tenant.id, e.target.value), "Paket tenant diperbarui", router)} aria-label={`Paket ${tenant.name}`}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.code}</option>)}</select></td>
                <td className="tiny">{tenant.eventCount} acara · {tenant.guestCount} tamu</td>
                <td className="tiny muted">{formatDateTime(tenant.createdAt)}</td>
                <td><div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                  <Button size="sm" onClick={async () => { const r = await impersonateTenantAction(tenant.id); if (r.ok) router.push(r.data.redirectTo); else toast(r.error, "err"); }}><Eye size={13} /> Impersonate</Button>
                  {tenant.status === "SUSPENDED" ? <Button size="sm" onClick={async () => showResult(await setTenantStatusAction(tenant.id, "ACTIVE"), "Tenant diaktifkan", router)}><ShieldCheck size={13} /></Button> : <Button size="sm" variant="danger" aria-label="Suspend tenant" onClick={async () => showResult(await setTenantStatusAction(tenant.id, "SUSPENDED", "Ditangguhkan dari konsol admin"), "Tenant ditangguhkan", router)}><Ban size={13} /></Button>}
                  <Button size="sm" onClick={async () => showResult(await resetQuotaAction(tenant.id), "Kuota direset", router)}><RotateCcw size={13} /></Button>
                  <Button size="sm" onClick={() => setUser({ tenantId: tenant.id, name: "", email: "", password: "" })}><UserRoundCog size={13} /></Button>
                  <Button size="sm" onClick={async () => { const r = await gdprExportAction(tenant.id); if (!r.ok) { toast(r.error, "err"); return; } const blob = new Blob([r.data.json], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `gdpr-${tenant.slug}.json`; a.click(); URL.revokeObjectURL(url); }}><Download size={13} /></Button>
                  <Button size="sm" variant="danger" onClick={() => setGdpr({ id: tenant.id, name: tenant.name })}><Trash2 size={13} /></Button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>

      {user ? <Modal title="Buat pengguna tenant" onClose={() => setUser(null)}><div className="stack">
        <div className="field"><label className="label">Nama</label><input className="input" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} /></div>
        <div className="field"><label className="label">Email</label><input className="input" type="email" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} /></div>
        <div className="field"><label className="label">Kata sandi awal</label><input className="input" value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></div>
        <Button variant="primary" onClick={async () => { const r = await createTenantUserAction({ ...user, role: "EVENT_OWNER" }); if (r.ok) { toast("Pengguna dibuat"); setUser(null); router.refresh(); } else toast(r.error, "err"); }}>Buat pengguna</Button>
      </div></Modal> : null}

      {gdpr ? <Modal title="Hapus data tenant (UU PDP / GDPR)" onClose={() => setGdpr(null)}><div className="stack">
        <div className="notice notice-error">Tindakan ini menghapus seluruh data operasional tenant dan tidak dapat dibatalkan. Audit log tetap disimpan sesuai retensi.</div>
        <div className="field"><label className="label">Ketik nama tenant: <strong>{gdpr.name}</strong></label><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <Button variant="danger" onClick={async () => showResult(await gdprDeleteAction(gdpr.id, confirm), "Data tenant dihapus", router)} disabled={confirm !== gdpr.name}>Hapus permanen</Button>
      </div></Modal> : null}
    </div>
  );
}

export function PlansAdmin({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("plans");
  const [coupon, setCoupon] = useState({ code: "", type: "PERCENT" as "PERCENT" | "FIXED", value: 10, maxRedemptions: 100, validUntil: "", active: true });
  const [payout, setPayout] = useState({ referralId: "", amount: 0, note: "" });
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Paket, harga & kupon</h1><p className="page-subtitle">Feature flags per paket, batas kuota, trial, diskon, referral & payout reseller.</p></div></div>
      <div className="card"><Tabs tabs={[{ id: "plans", label: "Paket" }, { id: "coupons", label: "Kupon & diskon" }, { id: "reseller", label: "Reseller & payout" }]} active={tab} onChange={setTab} />
        <div style={{ marginTop: 20 }}>
          {tab === "plans" ? <div className="grid grid-3">{plans.map((plan) => {
            const limits = parseLimits(plan.limits); const features = parseFeatures(plan.features);
            return <div className="card" key={plan.id}><div className="row-between"><strong>{plan.name}</strong><Badge tone="primary">{plan.code}</Badge></div>
              <div className="small muted" style={{ margin: "10px 0" }}>{formatCurrency(plan.monthlyPrice)}/bln · {formatCurrency(plan.yearlyPrice)}/thn · trial {plan.trialDays} hari</div>
              <div className="tiny">{limits.maxEvents} acara · {limits.maxGuestsPerEvent} tamu/acara · {limits.maxBlastsPerMonth} blast/bln · {limits.seats} seat</div>
              <div className="pill-row" style={{ margin: "10px 0" }}>{Object.entries(features).filter(([, value]) => value).map(([key]) => <Badge key={key}>{key}</Badge>)}</div>
              <Button size="sm" onClick={async () => showResult(await savePlanAction({ id: plan.id, code: plan.code, name: plan.name, description: "", monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, trialDays: plan.trialDays, limits, features: Object.fromEntries(Object.entries(features)), sortOrder: 0, isActive: plan.isActive }), "Paket disimpan", router)}><Save size={13} /> Simpan</Button>
            </div>;
          })}</div> : null}
          {tab === "coupons" ? <div className="stack" style={{ maxWidth: 560 }}>
            <div className="grid grid-2">
              <div className="field"><label className="label">Kode</label><input className="input mono" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })} /></div>
              <div className="field"><label className="label">Tipe</label><select className="select" value={coupon.type} onChange={(e) => setCoupon({ ...coupon, type: e.target.value as "PERCENT" | "FIXED" })}><option value="PERCENT">Persen (%)</option><option value="FIXED">Nominal (IDR)</option></select></div>
              <div className="field"><label className="label">Nilai</label><input className="input" type="number" value={coupon.value} onChange={(e) => setCoupon({ ...coupon, value: Number(e.target.value) })} /></div>
              <div className="field"><label className="label">Maks. pemakaian</label><input className="input" type="number" value={coupon.maxRedemptions} onChange={(e) => setCoupon({ ...coupon, maxRedemptions: Number(e.target.value) })} /></div>
            </div>
            <Button variant="primary" onClick={async () => showResult(await saveCouponAction({ ...coupon, validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString() : null }), "Kupon disimpan", router)}><Sparkles size={15} /> Simpan kupon</Button>
          </div> : null}
          {tab === "reseller" ? <div className="stack" style={{ maxWidth: 560 }}>
            <div className="field"><label className="label">ID referral</label><input className="input" value={payout.referralId} onChange={(e) => setPayout({ ...payout, referralId: e.target.value })} /></div>
            <div className="field"><label className="label">Nominal komisi</label><input className="input" type="number" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: Number(e.target.value) })} /></div>
            <div className="field"><label className="label">Catatan</label><input className="input" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} /></div>
            <Button variant="primary" onClick={async () => showResult(await createPayoutAction(payout.referralId, payout.amount, payout.note), "Payout dicatat", router)}>Catat payout</Button>
          </div> : null}
        </div>
      </div>
    </div>
  );
}

export function TemplatesAdmin({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", category: "Pernikahan", themeId: "elegant-ivory", status: "PUBLISHED" as "DRAFT" | "PUBLISHED" | "UNPUBLISHED", featured: false });
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Moderasi & marketplace template</h1><p className="page-subtitle">Publikasikan template ke katalog publik, tandai unggulan, dan kelola versi.</p></div></div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card"><h3>Terbitkan template baru</h3><div className="stack" style={{ marginTop: 14 }}>
          <div className="grid grid-2"><div className="field"><label className="label">Kode unik</label><input className="input mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div><div className="field"><label className="label">Nama</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div></div>
          <div className="grid grid-2"><div className="field"><label className="label">Kategori</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div><div className="field"><label className="label">Status</label><select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option><option value="UNPUBLISHED">UNPUBLISHED</option></select></div></div>
          <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Tandai sebagai unggulan</label>
          <Button variant="primary" onClick={async () => showResult(await saveTemplateAction({ ...form, tags: [], config: {} }), "Template disimpan", router)}><Plus size={15} /> Simpan template</Button>
        </div></div>
        <div className="card"><h3>Katalog</h3>{templates.length === 0 ? <EmptyState title="Belum ada template" /> : <div className="stack" style={{ marginTop: 12 }}>{templates.map((row) => <div className="row-between" key={row.id} style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 10 }}><div><strong className="small">{row.name}</strong><div className="tiny muted">{row.code} · {row.category} · {row.themeId}</div></div><div className="row"><Badge tone={row.status === "PUBLISHED" ? "success" : "warn"}>{row.status}</Badge>{row.featured ? <Badge tone="primary">Unggulan</Badge> : null}</div></div>)}</div>}</div>
      </div>
    </div>
  );
}

export function ModerationAdmin({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Moderasi & keamanan</h1><p className="page-subtitle">Laporan penyalahgunaan konten undangan publik.</p></div></div>
      {reports.length === 0 ? <div className="card"><EmptyState title="Tidak ada laporan terbuka" description="Semua laporan sudah ditindaklanjuti." /></div> : <div className="stack">{reports.map((report) => <div className="card row-between" key={report.id}><div><strong>{report.reason}</strong><div className="small muted" style={{ marginTop: 6 }}>{report.details || "—"}</div><div className="tiny muted">{report.reporterEmail ?? "Anonim"} · {formatDateTime(report.createdAt)}</div></div><div className="row"><Badge tone={report.status === "OPEN" ? "warn" : "success"}>{report.status}</Badge><Button size="sm" onClick={async () => showResult(await resolveReportAction(report.id, "RESOLVED"), "Laporan diselesaikan", router)}><ShieldCheck size={13} /></Button><Button size="sm" variant="danger" onClick={async () => showResult(await resolveReportAction(report.id, "DISMISSED"), "Laporan ditolak", router)}><Ban size={13} /></Button></div></div>)}</div>}
    </div>
  );
}

export function AnnouncementsAdmin({ items }: { items: AnnouncementRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Pengumuman</h1><p className="page-subtitle">Notifikasi platform untuk seluruh tenant atau segmen tertentu.</p></div></div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card"><h3>Pengumuman baru</h3><div className="stack" style={{ marginTop: 14 }}>
          <div className="field"><label className="label">Judul</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label className="label">Isi</label><textarea className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div className="field"><label className="label">Audience</label><select className="select" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="all">Semua tenant</option><option value="active">Tenant aktif</option><option value="trial">Trial</option></select></div>
          <Button variant="primary" onClick={async () => showResult(await saveAnnouncementAction({ title: form.title, body: form.body, audience: [form.audience] }), "Pengumuman diterbitkan", router)}><Megaphone size={15} /> Terbitkan</Button>
        </div></div>
        <div className="card"><h3>Riwayat</h3>{items.length === 0 ? <EmptyState title="Belum ada pengumuman" /> : <div className="stack" style={{ marginTop: 12 }}>{items.map((item) => <div key={item.id} style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 12 }}><div className="row-between"><strong className="small">{item.title}</strong><Badge tone={item.active ? "success" : "default"}>{item.active ? "Aktif" : "Nonaktif"}</Badge></div><p className="small muted" style={{ marginTop: 6 }}>{item.body}</p><span className="tiny muted">{formatDateTime(item.publishedAt)}</span></div>)}</div>}</div>
      </div>
    </div>
  );
}

export function SettingsAdmin({ flags, settings, tenants }: { flags: FlagRow[]; settings: SettingRow[]; tenants: TenantRow[] }) {
  const router = useRouter();
  const [key, setKey] = useState("maintenance");
  const [value, setValue] = useState("false");
  const [secret, setSecret] = useState("");
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Pengaturan sistem</h1><p className="page-subtitle">Payment, WhatsApp, email, storage, domain whitelist, SEO, bahasa, mata uang, backup & GDPR.</p></div><div className="row"><a href="/api/admin/backup" className="btn btn-sm"><Download size={14} /> Backup JSON</a><Button size="sm" onClick={async () => { const r = await rotateSecretAction(); if (r.ok) { setSecret(r.data.secret); toast("Secret baru dibuat"); } }}><KeyRound size={14} /> Rotasi secret</Button></div></div>
      {secret ? <div className="notice">Encrypted secret baru: <code className="mono">{secret}</code> <CopyButton value={secret} label="Salin" /></div> : null}
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card"><h3><Settings2 size={16} style={{ verticalAlign: -3 }} /> System settings</h3><div className="stack" style={{ marginTop: 14 }}>
          <div className="field"><label className="label">Kunci</label><select className="select" value={key} onChange={(e) => setKey(e.target.value)}>{["maintenance", "payment", "whatsapp", "email", "storage", "smtp", "domainWhitelist", "seo", "language", "currency", "backup", "retention"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label className="label">Nilai (JSON atau boolean)</label><input className="input mono" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <Button variant="primary" onClick={async () => { let parsed: unknown = value; try { parsed = JSON.parse(value); } catch { /* simpan sebagai string */ } await showResult(await setSystemSettingAction(key, parsed), "Pengaturan disimpan", router); }}><Save size={15} /> Simpan</Button>
          <div className="divider" />
          {settings.length === 0 ? <EmptyState title="Belum ada pengaturan" /> : settings.map((row) => <div className="row-between tiny" key={row.key} style={{ borderBottom: "1px solid var(--ui-border)", padding: "8px 0" }}><code className="mono">{row.key}</code><span className="mono">{JSON.stringify(row.value).slice(0, 90)}</span></div>)}
        </div></div>
        <div className="card"><h3><Flag size={16} style={{ verticalAlign: -3 }} /> Feature flags</h3><div className="stack" style={{ marginTop: 14 }}>
          {(flags.length ? flags : [{ key: "customCss", enabledGlobally: true }, { key: "offlineCheckin", enabledGlobally: true }, { key: "livestream", enabledGlobally: false }]).map((flag) => <div className="row-between" key={flag.key} style={{ borderBottom: "1px solid var(--ui-border)", padding: "9px 0" }}><code className="mono small">{flag.key}</code><Button size="sm" variant={flag.enabledGlobally ? "primary" : "default"} onClick={async () => showResult(await setFeatureFlagAction(flag.key, !flag.enabledGlobally, {}), "Flag diperbarui", router)}>{flag.enabledGlobally ? "Aktif" : "Nonaktif"}</Button></div>)}
          <div className="notice tiny">Override per-tenant tersedia lewat <code>setFeatureFlagAction(key, enabled, {"{"}tenantId: true{"}"})</code>. {tenants.length} tenant terdaftar.</div>
        </div></div>
      </div>
      <Card style={{ marginTop: 20 }}><h3>GDPR / UU PDP</h3><p className="small muted" style={{ marginTop: 8 }}>Ekspor dan penghapusan data per tenant tersedia di halaman <a href="/admin/tenants" style={{ color: "var(--ui-primary)" }}>Tenant</a>. Semua permintaan dicatat di audit log.</p></Card>
    </div>
  );
}

export function KpiTiles({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-4">
      {[
        ["MRR", formatCurrency(kpis.mrr)], ["ARR", formatCurrency(kpis.arr)], ["Tenant aktif", kpis.activeTenants], ["Trial", kpis.trialTenants],
        ["Acara terbit", kpis.publishedEvents], ["RSVP", kpis.rsvpTotal], ["Churn", `${kpis.churn}%`], ["Konversi trial", `${kpis.trialConversion}%`],
        ["Error rate", `${kpis.errorRate}%`], ["Storage", `${kpis.storageMb} MB`], ["Bandwidth", `${kpis.bandwidthMb} MB`], ["Faktur lunas", kpis.paidInvoices],
      ].map(([label, value]) => <Card key={String(label)} className="card-hover"><div className="stat-label">{label}</div><div className="stat-value">{value}</div></Card>)}
    </div>
  );
}
