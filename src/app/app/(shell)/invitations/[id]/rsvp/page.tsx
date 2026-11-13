import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getEntForInvitation, getOwnedInvitation } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Badge, BarChart, Empty, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { moderateWishAction, updateInvitationSettingsAction } from "@/server/actions/customer";
import { dateID } from "@/lib/format";

export const metadata = { title: "RSVP & Statistik" };

export default async function RsvpPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireCustomer();
  const inv = await getOwnedInvitation(Number((await params).id), u.id);
  if (!inv) notFound();
  const ent = await getEntForInvitation(inv);
  const [rs, ws, gs] = await Promise.all([
    db.select().from(s.rsvps).where(eq(s.rsvps.invitationId, inv.id)).orderBy(desc(s.rsvps.createdAt)),
    db.select().from(s.wishes).where(eq(s.wishes.invitationId, inv.id)).orderBy(desc(s.wishes.createdAt)),
    db.select().from(s.guests).where(eq(s.guests.invitationId, inv.id)),
  ]);
  const hadir = rs.filter((r) => r.attending), tidak = rs.filter((r) => !r.attending);
  const people = hadir.reduce((a, r) => a + r.count, 0);
  const opened = gs.filter((g) => g.opens > 0).length, shared = gs.filter((g) => g.shared).length, checked = gs.filter((g) => g.checkedInAt).length;
  const cats = Array.from(new Set(gs.map((g) => g.category ?? "Umum")));
  const hid = <input type="hidden" name="id" value={inv.id} />;
  const hide = (label: string) => <span className="text-stone-400" title={label}>🔒</span>;
  return (
    <>
      <Link href="/app/invitations" className="text-sm text-stone-500">← Undangan saya</Link>
      <PageHeader title={`RSVP & Statistik · ${inv.title}`} actions={ent.exportData ? <a className="btn btn-ghost" href={`/api/invitations/${inv.id}/export?type=rsvp`}><Download size={16} /> Export RSVP</a> : <span className="text-xs text-stone-400">Export RSVP: paket Exclusive 🔒</span>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Undangan dibuka" value={inv.views} hint="total kunjungan" />
        <StatCard label="Link dibagikan" value={ent.analytics === "none" ? hide("Premium") : inv.shares} />
        <StatCard label="RSVP hadir" value={ent.analytics === "none" ? rs.filter((r) => r.attending).length : `${hadir.length} (${people} orang)`} />
        <StatCard label="Tidak hadir" value={tidak.length} />
      </div>
      {ent.analytics !== "none" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-4"><h2 className="mb-3 text-sm font-semibold">Funnel tamu personal</h2>
            <BarChart data={[{ label: "Tamu", value: gs.length }, { label: "Dibagikan", value: shared }, { label: "Dibuka", value: opened }, { label: "RSVP", value: gs.filter((g) => g.attendance !== "pending").length }, { label: "Check-in", value: checked }]} /></div>
          <div className="card p-4"><h2 className="mb-3 text-sm font-semibold">Analitik lanjutan</h2>
            {ent.analytics === "advanced" ? (<ul className="space-y-2 text-sm">
              <li>Open rate: <b>{gs.length ? Math.round((opened / gs.length) * 100) : 0}%</b></li><li>Response rate RSVP: <b>{gs.length ? Math.round((gs.filter((g) => g.attendance !== "pending").length / gs.length) * 100) : 0}%</b></li>
              {cats.map((c) => <li key={c} className="text-xs text-stone-600">{c}: {gs.filter((g) => g.category === c).length} tamu · {gs.filter((g) => g.category === c && g.attendance === "hadir").length} hadir</li>)}</ul>)
              : <p className="text-sm text-stone-500">Analitik lanjutan (open rate, response rate, per kategori) tersedia di paket Exclusive 🔒</p>}</div>
        </div>)}

      <ActionForm action={updateInvitationSettingsAction} className="card mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        {hid}<label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="rsvpEnabled" defaultChecked={inv.settings?.rsvpEnabled !== false} className="h-5 w-5" /> Aktifkan RSVP</label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="moderate" defaultChecked={!!inv.settings?.moderate} className="h-5 w-5" /> Moderasi ucapan (perlu persetujuan)</label>
        <Submit className="btn btn-primary btn-sm">Simpan</Submit>
      </ActionForm>

      <h2 className="font-display mb-3 mt-8 text-lg font-semibold">Daftar RSVP ({rs.length})</h2>
      {rs.length === 0 ? <Empty title="Belum ada RSVP" /> : (
        <TableWrap><thead><tr><th className="th">Nama</th><th className="th">Status</th><th className="th">Jumlah</th><th className="th">Pesan</th><th className="th">Waktu</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rs.map((r) => (<tr key={r.id}><td className="td font-medium">{r.name}</td><td className="td">{r.attending ? <Badge tone="green">Hadir</Badge> : <Badge tone="red">Tidak hadir</Badge>}</td><td className="td">{r.count}</td><td className="td max-w-[240px] truncate text-stone-500">{r.message}</td><td className="td whitespace-nowrap text-xs text-stone-500">{dateID(r.createdAt, true)}</td></tr>))}</tbody></TableWrap>)}

      <h2 className="font-display mb-3 mt-8 text-lg font-semibold">Ucapan & buku tamu ({ws.length})</h2>
      {!ent.guestbook ? <Empty title="Buku tamu tersedia di paket Premium" /> : ws.length === 0 ? <Empty title="Belum ada ucapan" /> : (
        <div className="space-y-2">{ws.map((w) => (
          <div key={w.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="text-sm font-semibold">{w.name} {w.approved ? <Badge tone="green">Tampil</Badge> : <Badge tone="amber">Menunggu</Badge>}</p><p className="whitespace-pre-line text-sm text-stone-600">{w.message}</p></div>
            <div className="flex gap-2">
              <ActionForm action={moderateWishAction}>{hid}<input type="hidden" name="wishId" value={w.id} /><input type="hidden" name="op" value={w.approved ? "hide" : "approve"} /><Submit className="btn btn-ghost btn-sm">{w.approved ? "Sembunyikan" : "Setujui"}</Submit></ActionForm>
              <ActionForm action={moderateWishAction} confirm="Hapus ucapan ini?">{hid}<input type="hidden" name="wishId" value={w.id} /><input type="hidden" name="op" value="delete" /><Submit className="btn btn-ghost btn-sm text-red-600">Hapus</Submit></ActionForm>
            </div>
          </div>))}</div>)}
    </>
  );
}
