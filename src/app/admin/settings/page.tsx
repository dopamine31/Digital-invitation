import { requireOwner } from "@/lib/auth";
import { getSite, getSystem } from "@/server/core";
import { getPaymentAdapter } from "@/adapters/payment";
import { getEmailAdapter } from "@/adapters/email";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Badge, Field, PageHeader } from "@/components/ui";
import { saveSiteAction, saveSystemAction } from "@/server/actions/admin";
import { pool } from "@/db";

export const metadata = { title: "Pengaturan" };

const Check = ({ name, label, on }: { name: string; label: string; on: boolean }) => (
  <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="hidden" name={`${name}__present`} value="1" /><input type="checkbox" name={name} defaultChecked={on} className="h-5 w-5" /> {label}</label>
);

export default async function SettingsPage() {
  await requireOwner();
  const [site, sys] = await Promise.all([getSite(), getSystem()]);
  let dbOk = false; try { await pool.query("select 1"); dbOk = true; } catch { /* abaikan */ }
  const pay = getPaymentAdapter(sys.paymentProvider);
  const mail = getEmailAdapter();
  const text = (k: keyof typeof site, label: string, hint?: string) => <Field label={label} hint={hint}><input name={k} defaultValue={site[k]} className="input" /></Field>;
  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Website, SEO, PWA, dan sistem." />
      <div className="grid gap-4 xl:grid-cols-2">
        <ActionForm action={saveSiteAction} className="card space-y-3 p-4"><h2 className="font-semibold">Website & brand</h2>
          {text("name", "Nama bisnis")}{text("tagline", "Tagline")}
          <div className="grid grid-cols-2 gap-3">{text("whatsapp", "WhatsApp (628…)")}{text("email", "Email bisnis")}</div>{text("address", "Alamat")}
          <div className="grid grid-cols-2 gap-3"><Field label="Warna brand"><input name="brandColor" type="color" defaultValue={site.brandColor} className="h-11 w-full rounded-lg border border-stone-300 bg-white p-1" /></Field>{text("font", "Font")}</div>
          <div className="grid grid-cols-2 gap-3">{text("logo", "URL logo")}{text("favicon", "URL favicon")}</div>
          <div className="grid grid-cols-2 gap-3">{text("instagram", "Instagram")}{text("facebook", "Facebook")}{text("tiktok", "TikTok")}{text("youtube", "YouTube")}</div>{text("domain", "Domain")}
          <h3 className="pt-2 text-sm font-semibold">SEO & PWA</h3>{text("seoTitle", "Meta title")}<Field label="Meta description"><textarea name="seoDesc" rows={2} defaultValue={site.seoDesc} className="input" /></Field>{text("ogImage", "Open Graph image")}
          <div className="grid grid-cols-2 gap-3">{text("pwaName", "Nama PWA")}{text("pwaShort", "Nama pendek PWA")}</div>
          <Submit className="btn btn-brand">Simpan pengaturan website</Submit></ActionForm>
        <div className="space-y-4">
          <ActionForm action={saveSystemAction} className="card space-y-3 p-4"><h2 className="font-semibold">Sistem</h2>
            <Check name="maintenance" label="Mode maintenance (halaman publik ditutup untuk non-staff)" on={sys.maintenance} /><Check name="twoFactor" label="Wajibkan 2FA staff (butuh Supabase Auth)" on={sys.twoFactor} /><Check name="notifyEmail" label="Notifikasi email" on={sys.notifyEmail} /><Check name="notifyPush" label="Notifikasi push (butuh integrasi)" on={sys.notifyPush} />
            <div className="grid grid-cols-3 gap-3"><Field label="Maks upload (MB)"><input name="maxUploadMB" type="number" min={1} max={50} defaultValue={sys.maxUploadMB} className="input" /></Field><Field label="Maks foto"><input name="maxPhotos" type="number" min={1} max={50} defaultValue={sys.maxPhotos} className="input" /></Field><Field label="Sesi (hari)"><input name="sessionDays" type="number" min={1} max={30} defaultValue={sys.sessionDays} className="input" /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Payment provider"><select name="paymentProvider" defaultValue={sys.paymentProvider} className="input"><option value="demo">Demo (simulasi)</option><option value="midtrans">Midtrans</option><option value="xendit">Xendit</option></select></Field>
              <Field label="Backup"><select name="backup" defaultValue={sys.backup} className="input"><option value="off">Nonaktif</option><option value="daily">Harian</option><option value="weekly">Mingguan</option></select></Field></div>
            <div className="grid grid-cols-3 gap-3"><Field label="Bank"><input name="bankName" defaultValue={sys.bankName} className="input" /></Field><Field label="No. rekening"><input name="bankNumber" defaultValue={sys.bankNumber} className="input" /></Field><Field label="Atas nama"><input name="bankHolder" defaultValue={sys.bankHolder} className="input" /></Field></div>
            <Submit className="btn btn-brand">Simpan pengaturan sistem</Submit></ActionForm>
          <div className="card space-y-2 p-4 text-sm"><h2 className="font-semibold">Status integrasi (jujur)</h2>
            <p>Database PostgreSQL: {dbOk ? <Badge tone="green">Terhubung</Badge> : <Badge tone="red">Gagal</Badge>}</p>
            <p>Payment gateway: <Badge tone={pay.live ? "green" : "amber"}>{pay.name}{pay.live ? " (kunci terdeteksi)" : " — mode demo / belum dikonfigurasi"}</Badge></p>
            <p>Email: <Badge tone={mail === undefined || process.env.RESEND_API_KEY ? "green" : "amber"}>{process.env.RESEND_API_KEY ? "Resend aktif" : "Mode demo (log server)"}</Badge></p>
            <p>Storage: <Badge>{sys.storage === "database" ? "Data URL di database (demo). Gunakan Supabase Storage untuk produksi" : sys.storage}</Badge></p>
            <p className="text-xs text-stone-500">Rahasia (API key, service role) hanya dibaca dari environment server — tidak pernah disimpan di sini.</p></div>
        </div>
      </div>
    </>
  );
}
