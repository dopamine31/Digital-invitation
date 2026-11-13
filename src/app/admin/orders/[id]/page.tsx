import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { Check, X } from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { hasPerm, requirePerm } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field, ORDER_STATUSES, PageHeader, STATUS_LABEL, StatusBadge } from "@/components/ui";
import { orderMetaAction, setOrderStatusAction, verifyPaymentAction } from "@/server/actions/admin";
import { dateID, idr } from "@/lib/format";
import type { InvitationData } from "@/types";

export const metadata = { title: "Detail Pesanan" };

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePerm("orders");
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, Number((await params).id))).limit(1);
  if (!o) notFound();
  const [cust] = await db.select().from(s.users).where(eq(s.users.id, o.userId)).limit(1);
  const [pay] = await db.select().from(s.payments).where(eq(s.payments.orderId, o.id)).limit(1);
  const [tpl] = o.templateId ? await db.select().from(s.templates).where(eq(s.templates.id, o.templateId)).limit(1) : [];
  const [inv] = o.invitationId ? await db.select().from(s.invitations).where(eq(s.invitations.id, o.invitationId)).limit(1) : [];
  const staff = await db.select().from(s.users).where(ne(s.users.role, "customer"));
  const history = await db.select({ l: s.activityLogs, name: s.users.name }).from(s.activityLogs).leftJoin(s.users, eq(s.activityLogs.userId, s.users.id)).where(and(eq(s.activityLogs.entity, "order"), eq(s.activityLogs.entityId, o.id))).orderBy(desc(s.activityLogs.createdAt));
  const d = inv?.data as InvitationData | undefined;
  const checks = d ? [["Nama mempelai/pemilik acara", !!d.host1?.name], ["Tanggal acara", !!d.date], ["Detail acara & lokasi", d.events.length > 0 && !!d.locationName], ["Foto cover", !!d.coverPhoto], ["Galeri foto", d.gallery.length > 0], ["Hadiah digital", d.gifts.some((g) => g.number)]] as const : [];
  const hid = <input type="hidden" name="orderId" value={o.id} />;
  const canPay = hasPerm(u, "payments");
  return (
    <>
      <Link href="/admin/orders" className="text-sm text-stone-500">← Semua pesanan</Link>
      <PageHeader title={o.number} subtitle={`${dateID(o.createdAt, true)} · ${cust?.name}`} actions={<StatusBadge status={o.status} />} />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="card p-4 text-sm"><h2 className="mb-3 font-semibold">Rincian</h2>
            <dl className="grid grid-cols-2 gap-3"><div><dt className="text-xs text-stone-400">Customer</dt><dd><Link className="underline" href={`/admin/customers/${cust.id}`}>{cust.name}</Link><br /><span className="text-xs text-stone-500">{cust.email} · {cust.phone}</span></dd></div>
              <div><dt className="text-xs text-stone-400">Template</dt><dd>{tpl?.name ?? "-"}</dd></div><div><dt className="text-xs text-stone-400">Paket</dt><dd className="capitalize">{o.packageCode} {o.addons.length ? `+ ${o.addons.join(", ")}` : ""}</dd></div>
              <div><dt className="text-xs text-stone-400">Subtotal / Diskon</dt><dd>{idr(o.subtotal)} / {idr(o.discount)} {o.voucherCode && `(${o.voucherCode})`}</dd></div><div><dt className="text-xs text-stone-400">Total</dt><dd className="font-display text-lg font-semibold">{idr(o.total)}</dd></div>
              {inv && <div><dt className="text-xs text-stone-400">Undangan</dt><dd><Link className="underline" target="_blank" href={`/i/${inv.slug}`}>/i/{inv.slug}</Link></dd></div>}</dl>
            {o.customerNote && <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs"><b>Catatan customer:</b> {o.customerNote}</p>}</section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Pembayaran</h2>
            {pay ? (<div className="text-sm"><p>Metode <b>{pay.method}</b> · ref <span className="font-mono text-xs">{pay.reference}</span> · <StatusBadge status={pay.status} /></p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pay.proof ? <img src={pay.proof} alt="Bukti pembayaran" className="mt-3 max-h-72 rounded-lg border" /> : <p className="mt-2 text-xs text-stone-500">Belum ada bukti pembayaran.</p>}
              {canPay && (o.status === "menunggu_verifikasi" || pay.status === "menunggu_verifikasi") && (
                <div className="mt-3 flex gap-2"><ActionForm action={verifyPaymentAction}>{hid}<input type="hidden" name="op" value="approve" /><Submit className="btn btn-brand btn-sm"><Check size={14} /> Verifikasi</Submit></ActionForm>
                  <ActionForm action={verifyPaymentAction} confirm="Tolak bukti pembayaran ini?">{hid}<input type="hidden" name="op" value="reject" /><Submit className="btn btn-ghost btn-sm text-red-600"><X size={14} /> Tolak</Submit></ActionForm></div>)}</div>) : <p className="text-sm text-stone-500">Tidak ada data pembayaran.</p>}</section>
          {checks.length > 0 && <section className="card p-4"><h2 className="mb-3 font-semibold">Kelengkapan data undangan</h2><ul className="grid gap-1.5 text-sm sm:grid-cols-2">{checks.map(([l, okk]) => <li key={l} className="flex items-center gap-2">{okk ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-red-500" />}{l}</li>)}</ul></section>}
          <section className="card p-4"><h2 className="mb-3 font-semibold">Riwayat perubahan</h2>{history.length === 0 ? <p className="text-sm text-stone-500">Belum ada riwayat.</p> : <ul className="space-y-2 text-sm">{history.map(({ l, name }) => <li key={l.id}><b>{name ?? "Sistem"}</b> — {l.action}: {l.detail} <span className="text-xs text-stone-400">· {dateID(l.createdAt, true)}</span></li>)}</ul>}</section>
        </div>
        <div className="space-y-4">
          <ActionForm action={setOrderStatusAction} className="card space-y-3 p-4">{hid}<Field label="Ubah status"><select name="status" defaultValue={o.status} className="input">{ORDER_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select></Field><Submit>Simpan status</Submit></ActionForm>
          {u.role === "owner" && <ActionForm action={orderMetaAction} className="card space-y-3 p-4">{hid}<input type="hidden" name="op" value="assign" /><Field label="Tugaskan ke staff"><select name="assignedTo" defaultValue={o.assignedTo ?? 0} className="input"><option value={0}>— Tidak ditugaskan —</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.role})</option>)}</select></Field><Submit className="btn btn-ghost">Simpan penugasan</Submit></ActionForm>}
          {u.role === "owner" && <ActionForm action={orderMetaAction} className="card space-y-3 p-4">{hid}<input type="hidden" name="op" value="discount" /><Field label="Diskon manual (Rp)" hint="Mengganti total diskon pesanan"><input name="discount" type="number" min={0} defaultValue={o.discount} className="input" /></Field><Submit className="btn btn-ghost">Terapkan diskon</Submit></ActionForm>}
          <ActionForm action={orderMetaAction} className="card space-y-3 p-4">{hid}<input type="hidden" name="op" value="note" /><Field label="Catatan internal"><textarea name="note" defaultValue={o.note ?? ""} className="input" rows={3} /></Field><Submit className="btn btn-ghost">Simpan catatan</Submit></ActionForm>
          <ActionForm action={orderMetaAction} resetOnSuccess className="card space-y-3 p-4">{hid}<input type="hidden" name="op" value="instruction" /><Field label="Kirim instruksi ke customer" hint="Muncul sebagai notifikasi di dashboard customer"><textarea name="message" required className="input" rows={3} /></Field><Submit className="btn btn-ghost">Kirim</Submit></ActionForm>
        </div>
      </div>
    </>
  );
}
