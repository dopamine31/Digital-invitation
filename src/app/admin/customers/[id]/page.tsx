import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { PageHeader, StatusBadge } from "@/components/ui";
import { customerAdminAction } from "@/server/actions/admin";
import { dateID, idr, timeAgo } from "@/lib/format";

export const metadata = { title: "Profil Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("customers");
  const [c] = await db.select().from(s.users).where(and(eq(s.users.id, Number((await params).id)), eq(s.users.role, "customer"))).limit(1);
  if (!c) notFound();
  const [orders, invs, logs] = await Promise.all([
    db.select().from(s.orders).where(eq(s.orders.userId, c.id)).orderBy(desc(s.orders.createdAt)),
    db.select().from(s.invitations).where(and(eq(s.invitations.userId, c.id), isNull(s.invitations.deletedAt))),
    db.select().from(s.activityLogs).where(eq(s.activityLogs.userId, c.id)).orderBy(desc(s.activityLogs.createdAt)).limit(10),
  ]);
  const hid = <input type="hidden" name="userId" value={c.id} />;
  return (
    <>
      <Link href="/admin/customers" className="text-sm text-stone-500">← Customer</Link>
      <PageHeader title={c.name} subtitle={`${c.email} · ${c.phone || "-"} · bergabung ${dateID(c.createdAt)}`} actions={<StatusBadge status={c.status} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4"><h2 className="mb-3 font-semibold">Undangan ({invs.length})</h2>{invs.length === 0 ? <p className="text-sm text-stone-500">Belum ada.</p> : <ul className="divide-y divide-stone-100">{invs.map((i) => <li key={i.id} className="flex items-center justify-between py-2 text-sm"><Link className="underline" target="_blank" href={`/i/${i.slug}`}>{i.title}</Link><span className="flex items-center gap-2"><span className="text-xs capitalize text-stone-500">{i.packageCode}</span><StatusBadge status={i.status} /></span></li>)}</ul>}</section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Riwayat transaksi ({orders.length})</h2>{orders.length === 0 ? <p className="text-sm text-stone-500">Belum ada.</p> : <ul className="divide-y divide-stone-100">{orders.map((o) => <li key={o.id} className="flex items-center justify-between py-2 text-sm"><Link className="underline" href={`/admin/orders/${o.id}`}>{o.number}</Link><span className="flex items-center gap-2">{idr(o.total)}<StatusBadge status={o.status} /></span></li>)}</ul>}</section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Aktivitas</h2><ul className="space-y-1 text-sm">{logs.map((l) => <li key={l.id}>{l.action} <span className="text-xs text-stone-400">· {timeAgo(l.createdAt)}</span></li>)}</ul></section>
        </div>
        <div className="space-y-4">
          <ActionForm action={customerAdminAction} className="card space-y-3 p-4">{hid}<input type="hidden" name="op" value="note" /><label className="label">Catatan internal admin</label><textarea name="note" defaultValue={c.note ?? ""} rows={4} className="input" /><Submit className="btn btn-ghost">Simpan catatan</Submit></ActionForm>
          {me.role === "owner" && <ActionForm action={customerAdminAction} confirm={c.status === "active" ? "Blokir akun ini? Customer tidak bisa masuk." : "Aktifkan kembali akun ini?"} className="card p-4">{hid}<input type="hidden" name="op" value={c.status === "active" ? "block" : "activate"} /><Submit className={c.status === "active" ? "btn btn-danger w-full" : "btn btn-brand w-full"}>{c.status === "active" ? "Blokir akun" : "Aktifkan akun"}</Submit></ActionForm>}
        </div>
      </div>
    </>
  );
}
