import Link from "next/link";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { BarChart, Empty, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { dateID, idr, timeAgo } from "@/lib/format";

export const metadata = { title: "Dashboard Pengelola" };
const PAID = ["dibayar", "dalam_pengerjaan", "menunggu_revisi", "siap_diterbitkan", "selesai"];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const u = await requireStaff();
  const sp = await searchParams;
  const denied = sp.denied ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">Anda tidak memiliki izin untuk membuka halaman tersebut.</p> : null;

  if (u.role === "staff") {
    const mine = await db.select().from(s.orders).where(sql`${s.orders.assignedTo} = ${u.id} or (${s.orders.assignedTo} is null and ${s.orders.status} in ('dibayar','dalam_pengerjaan','menunggu_revisi'))`).orderBy(desc(s.orders.updatedAt)).limit(15);
    const tk = await db.select().from(s.tickets).where(ne(s.tickets.status, "selesai")).orderBy(desc(s.tickets.updatedAt)).limit(6);
    const logs = await db.select().from(s.activityLogs).where(eq(s.activityLogs.userId, u.id)).orderBy(desc(s.activityLogs.createdAt)).limit(8);
    return (
      <>
        {denied}<PageHeader title={`Halo, ${u.name.split(" ")[0]}`} subtitle="Tugas dan pekerjaan Anda hari ini." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Pesanan untuk saya" value={mine.length} /><StatCard label="Dalam pengerjaan" value={mine.filter((o) => o.status === "dalam_pengerjaan").length} />
          <StatCard label="Menunggu revisi" value={mine.filter((o) => o.status === "menunggu_revisi").length} /><StatCard label="Tiket terbuka" value={tk.length} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="card p-4"><h2 className="mb-3 font-semibold">Pesanan ditugaskan</h2>{mine.length === 0 ? <p className="text-sm text-stone-500">Tidak ada tugas.</p> : <ul className="divide-y divide-stone-100">{mine.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between py-2.5 text-sm"><span>{o.number}</span><StatusBadge status={o.status} /></Link></li>)}</ul>}</section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Tiket bantuan</h2>{tk.length === 0 ? <p className="text-sm text-stone-500">Tidak ada tiket terbuka.</p> : <ul className="divide-y divide-stone-100">{tk.map((t) => <li key={t.id}><Link href={`/admin/support/${t.id}`} className="flex items-center justify-between py-2.5 text-sm"><span className="truncate">{t.subject}</span><StatusBadge status={t.status} /></Link></li>)}</ul>}
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-stone-400">Aktivitas saya</h3><ul className="space-y-1 text-xs text-stone-600">{logs.map((l) => <li key={l.id}>{l.action} · <span className="text-stone-400">{timeAgo(l.createdAt)}</span></li>)}</ul></section>
        </div>
      </>
    );
  }

  const orders = await db.select().from(s.orders);
  const paid = orders.filter((o) => PAID.includes(o.status));
  const sum = (arr: typeof orders) => arr.reduce((a, o) => a + o.total, 0);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000), monthAgo = new Date(Date.now() - 30 * 86400000);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(startOfDay.getTime() - (13 - i) * 86400000); return { d, label: `${d.getDate()}/${d.getMonth() + 1}`, value: sum(paid.filter((o) => o.createdAt >= d && o.createdAt < new Date(d.getTime() + 86400000))) }; });
  const custs = await db.select({ createdAt: s.users.createdAt }).from(s.users).where(eq(s.users.role, "customer"));
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = new Date(Date.now() - (7 - i) * 7 * 86400000); return { label: `M${i + 1}`, value: custs.filter((c) => c.createdAt <= end).length }; });
  const [pubs] = await db.select({ c: sql<number>`count(*)::int` }).from(s.invitations).where(eq(s.invitations.status, "published"));
  const top = await db.select({ name: s.templates.name, c: sql<number>`count(*)::int` }).from(s.orders).innerJoin(s.templates, eq(s.orders.templateId, s.templates.id)).groupBy(s.templates.name).orderBy(desc(sql`count(*)`)).limit(5);
  const logs = await db.select({ l: s.activityLogs, name: s.users.name }).from(s.activityLogs).leftJoin(s.users, eq(s.activityLogs.userId, s.users.id)).orderBy(desc(s.activityLogs.createdAt)).limit(8);
  const alerts = [
    { n: orders.filter((o) => o.status === "menunggu_verifikasi").length, t: "pembayaran menunggu verifikasi", h: "/admin/orders?status=menunggu_verifikasi" },
    { n: orders.filter((o) => o.status === "menunggu_revisi").length, t: "pesanan menunggu revisi", h: "/admin/orders?status=menunggu_revisi" },
    { n: (await db.select().from(s.tickets).where(eq(s.tickets.status, "open"))).length, t: "tiket bantuan belum dibalas", h: "/admin/support" },
  ].filter((a) => a.n > 0);
  return (
    <>
      {denied}<PageHeader title="Dashboard Owner" subtitle="Ringkasan bisnis Digital Invitation Studio." />
      {alerts.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{alerts.map((a) => <Link key={a.t} href={a.h} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">🔔 {a.n} {a.t}</Link>)}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total pendapatan" value={idr(sum(paid))} hint={`${paid.length} pesanan dibayar`} /><StatCard label="Total pesanan" value={orders.length} hint={`${orders.filter((o) => o.status === "menunggu_pembayaran").length} menunggu bayar`} />
        <StatCard label="Dalam proses" value={orders.filter((o) => ["dalam_pengerjaan", "menunggu_revisi", "dibayar"].includes(o.status)).length} hint={`${orders.filter((o) => o.status === "selesai").length} selesai`} /><StatCard label="Customer" value={custs.length} hint={`${pubs.c} undangan terbit`} />
        <StatCard label="Hari ini" value={idr(sum(paid.filter((o) => o.createdAt >= startOfDay)))} /><StatCard label="7 hari" value={idr(sum(paid.filter((o) => o.createdAt >= weekAgo)))} /><StatCard label="30 hari" value={idr(sum(paid.filter((o) => o.createdAt >= monthAgo)))} />
        <StatCard label="Menunggu verifikasi" value={orders.filter((o) => o.status === "menunggu_verifikasi").length} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-4 font-semibold">Pendapatan 14 hari terakhir</h2><BarChart data={days} format={idr} /></section>
        <section className="card p-4"><h2 className="mb-4 font-semibold">Pertumbuhan customer (8 minggu)</h2><BarChart data={weeks} color="#1c1917" /></section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">Template paling laris</h2>{top.length === 0 ? <Empty title="Belum ada data" /> : <ol className="space-y-2">{top.map((t, i) => <li key={t.name} className="flex items-center justify-between text-sm"><span>{i + 1}. {t.name}</span><b>{t.c} pesanan</b></li>)}</ol>}</section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">Aktivitas terbaru</h2><ul className="space-y-2 text-sm">{logs.map(({ l, name }) => <li key={l.id}><b>{name ?? "Sistem"}</b> {l.action} <span className="text-xs text-stone-400">· {dateID(l.createdAt, true)}</span></li>)}</ul></section>
      </div>
    </>
  );
}
