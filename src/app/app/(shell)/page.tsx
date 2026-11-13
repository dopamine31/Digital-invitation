import Link from "next/link";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Eye, Mail, Plus, Receipt, Users } from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { Badge, Empty, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { TemplateThumb } from "@/components/TemplateThumb";
import { dateID, idr, timeAgo } from "@/lib/format";
import { TIER_RANK } from "@/lib/entitlements";
import type { TemplateConfig } from "@/types";

export const metadata = { title: "Ringkasan" };

export default async function CustomerHome() {
  const u = await requireCustomer();
  const invs = await db.select({ inv: s.invitations, tpl: s.templates }).from(s.invitations).innerJoin(s.templates, eq(s.invitations.templateId, s.templates.id))
    .where(and(eq(s.invitations.userId, u.id), isNull(s.invitations.deletedAt))).orderBy(desc(s.invitations.updatedAt));
  const orders = await db.select().from(s.orders).where(eq(s.orders.userId, u.id)).orderBy(desc(s.orders.createdAt)).limit(4);
  const notifs = await db.select().from(s.notifications).where(eq(s.notifications.userId, u.id)).orderBy(desc(s.notifications.createdAt)).limit(5);
  const logs = await db.select().from(s.activityLogs).where(eq(s.activityLogs.userId, u.id)).orderBy(desc(s.activityLogs.createdAt)).limit(5);
  const ids = invs.map((i) => i.inv.id);
  const [rs] = ids.length ? await db.select({ c: sql<number>`count(*)::int`, hadir: sql<number>`coalesce(sum(case when ${s.rsvps.attending} then ${s.rsvps.count} else 0 end),0)::int` }).from(s.rsvps).where(inArray(s.rsvps.invitationId, ids)) : [{ c: 0, hadir: 0 }];
  const best = invs.reduce<string>((b, i) => ((TIER_RANK[i.inv.packageCode] ?? 0) > (TIER_RANK[b] ?? 0) ? i.inv.packageCode : b), "free");
  const nearest = invs.map((i) => i.inv.expireAt).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0];
  const left = nearest ? Math.max(0, Math.ceil((nearest.getTime() - Date.now()) / 86400000)) : null;
  const pendingPay = orders.filter((o) => ["menunggu_pembayaran", "menunggu_verifikasi"].includes(o.status));
  return (
    <div className="space-y-6">
      <PageHeader title={`Halo, ${u.name.split(" ")[0]} 👋`} subtitle="Berikut ringkasan undangan dan pesanan Anda." actions={<Link href="/app/templates" className="btn btn-brand" data-testid="new-invitation"><Plus size={16} /> Buat undangan baru</Link>} />
      {pendingPay.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm"><span>Ada <b>{pendingPay.length}</b> pesanan yang menunggu pembayaran / verifikasi.</span><Link href={`/app/orders/${pendingPay[0].id}`} className="btn btn-primary btn-sm">Lihat pesanan</Link></div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Undangan" value={invs.length} hint={`${invs.filter((i) => i.inv.status === "published").length} terbit`} icon={<Mail size={16} />} />
        <StatCard label="Paket aktif" value={<span className="capitalize">{best}</span>} hint={left !== null ? `Sisa ${left} hari` : "Tanpa masa aktif"} />
        <StatCard label="RSVP masuk" value={rs.c} hint={`${rs.hadir} tamu hadir`} icon={<Users size={16} />} />
        <StatCard label="Total dilihat" value={invs.reduce((a, i) => a + i.inv.views, 0)} icon={<Eye size={16} />} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Undangan saya</h2><Link href="/app/invitations" className="text-sm font-medium underline">Kelola semua</Link></div>
        {invs.length === 0 ? <Empty title="Belum ada undangan" text="Pilih template pertama Anda dan mulai membuat undangan dalam hitungan menit." action={<Link href="/app/templates" className="btn btn-primary">Jelajahi template</Link>} /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {invs.slice(0, 3).map(({ inv, tpl }) => (
              <div key={inv.id} className="card flex gap-3 p-3">
                <div className="w-20 flex-none overflow-hidden rounded-lg"><TemplateThumb cfg={tpl.config as unknown as TemplateConfig} /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{inv.title}</p><p className="truncate text-xs text-stone-500">{tpl.name}</p><div className="mt-1 flex gap-1"><StatusBadge status={inv.status} /><Badge tone="violet">{inv.packageCode}</Badge></div>
                  <div className="mt-2 flex gap-2"><Link className="btn btn-primary btn-sm" href={`/app/invitations/${inv.id}/edit`}>Edit</Link><Link className="btn btn-ghost btn-sm" href={`/app/invitations/${inv.id}/rsvp`}>RSVP</Link></div></div>
              </div>))}
          </div>)}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Receipt size={16} /> Pesanan terbaru</h2>
          {orders.length === 0 ? <p className="text-sm text-stone-500">Belum ada pesanan.</p> : <ul className="divide-y divide-stone-100">{orders.map((o) => (
            <li key={o.id}><Link href={`/app/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm"><div className="min-w-0"><p className="truncate font-medium">{o.number}</p><p className="text-xs text-stone-500">{dateID(o.createdAt)} · {o.packageCode}</p></div><div className="flex flex-none flex-col items-end gap-1"><span className="font-semibold">{idr(o.total)}</span><StatusBadge status={o.status} /></div></Link></li>))}</ul>}
        </section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">Notifikasi</h2>
          {notifs.length === 0 ? <p className="text-sm text-stone-500">Tidak ada notifikasi.</p> : <ul className="space-y-3">{notifs.map((n) => (<li key={n.id} className="text-sm"><p className={n.read ? "text-stone-600" : "font-semibold"}>{n.title}</p><p className="text-xs text-stone-500">{n.body} · {timeAgo(n.createdAt)}</p></li>))}</ul>}
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-stone-400">Aktivitas terbaru</h3>
          <ul className="space-y-1.5 text-xs text-stone-600">{logs.map((l) => <li key={l.id}>{l.action} <span className="text-stone-400">· {timeAgo(l.createdAt)}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
