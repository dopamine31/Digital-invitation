"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, Download, Eye, MoreVertical, Pencil, QrCode, Share2, Users, BarChart3, ScanLine, X } from "lucide-react";
import { ActionForm, Submit, useToast } from "@/components/ActionForm";
import { QrImage, downloadQR } from "@/components/QrImage";
import { StatusBadge, Badge } from "@/components/ui";
import { TemplateThumb } from "@/components/TemplateThumb";
import { changeTemplateAction, deleteInvitationAction, duplicateInvitationAction, setInvitationStatusAction } from "@/server/actions/customer";
import type { TemplateConfig } from "@/types";

export type InvCardData = {
  id: number; slug: string; title: string; status: string; packageCode: string; templateName: string; cfg: TemplateConfig;
  views: number; shares: number; guests: number; rsvps: number; expireAt: string | null; qr: boolean; personalized: boolean; checkin: boolean;
};

export function InvitationCard({ inv, baseUrl, templates }: { inv: InvCardData; baseUrl: string; templates: { slug: string; name: string }[] }) {
  const [qr, setQr] = useState(false);
  const [menu, setMenu] = useState(false);
  const toast = useToast();
  const link = `${baseUrl}/i/${inv.slug}`;
  const hid = <input type="hidden" name="id" value={inv.id} />;
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="w-24 flex-none overflow-hidden rounded-lg"><TemplateThumb cfg={inv.cfg} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{inv.title}</p><p className="truncate text-xs text-stone-500">{inv.templateName}</p></div>
            <div className="relative">
              <button type="button" aria-label="Menu lainnya" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100"><MoreVertical size={18} /></button>
              {menu && (<>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-20 w-60 space-y-1 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                  <ActionForm action={duplicateInvitationAction}>{hid}<Submit className="btn btn-soft btn-sm w-full justify-start">Duplikasi undangan</Submit></ActionForm>
                  {inv.status === "published" && <ActionForm action={setInvitationStatusAction}>{hid}<input type="hidden" name="status" value="draft" /><Submit className="btn btn-soft btn-sm w-full justify-start">Unpublish (tarik)</Submit></ActionForm>}
                  {inv.status !== "archived" && <ActionForm action={setInvitationStatusAction} confirm="Arsipkan undangan ini? Link publik tidak akan bisa dibuka.">{hid}<input type="hidden" name="status" value="archived" /><Submit className="btn btn-soft btn-sm w-full justify-start">Arsipkan</Submit></ActionForm>}
                  {inv.status === "archived" && <ActionForm action={setInvitationStatusAction}>{hid}<input type="hidden" name="status" value="draft" /><Submit className="btn btn-soft btn-sm w-full justify-start">Pulihkan ke draft</Submit></ActionForm>}
                  <ActionForm action={changeTemplateAction} className="flex gap-1">{hid}<select name="template" aria-label="Ganti template" className="input !min-h-[36px] !py-1 text-xs">{templates.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select><Submit className="btn btn-soft btn-sm">Ganti</Submit></ActionForm>
                  <ActionForm action={deleteInvitationAction} confirm={`Hapus undangan "${inv.title}"? Tindakan ini tidak dapat dibatalkan.`}>{hid}<Submit className="btn btn-sm w-full justify-start text-red-600 hover:bg-red-50">Hapus undangan</Submit></ActionForm>
                </div></>)}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-1"><StatusBadge status={inv.status} /><Badge tone="violet">{inv.packageCode}</Badge></div>
          <p className="mt-2 text-xs text-stone-500">👁 {inv.views} · ↗ {inv.shares} · 👥 {inv.guests} tamu · ✅ {inv.rsvps} RSVP</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-stone-100 bg-stone-50 p-3">
        <Link href={`/app/invitations/${inv.id}/edit`} className="btn btn-primary btn-sm"><Pencil size={14} /> Edit</Link>
        <Link href={`/i/${inv.slug}`} target="_blank" className="btn btn-ghost btn-sm"><Eye size={14} /> Preview</Link>
        <Link href={`/app/invitations/${inv.id}/guests`} className="btn btn-ghost btn-sm"><Users size={14} /> Tamu</Link>
        <Link href={`/app/invitations/${inv.id}/rsvp`} className="btn btn-ghost btn-sm"><BarChart3 size={14} /> RSVP & Statistik</Link>
        <Link href={`/app/invitations/${inv.id}/checkin`} className="btn btn-ghost btn-sm"><ScanLine size={14} /> Check-in</Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(link); toast("Link disalin."); }}><Copy size={14} /> Salin link</button>
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Kami mengundang Anda: ${link}`)}`}><Share2 size={14} /> WhatsApp</a>
        {inv.qr ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQr(true)}><QrCode size={14} /> QR</button> : <Link href={`/app/checkout?invitation=${inv.id}`} className="btn btn-soft btn-sm">🔒 Upgrade untuk QR</Link>}
        {inv.status === "draft" && <ActionForm action={setInvitationStatusAction}>{hid}<input type="hidden" name="status" value="published" /><Submit className="btn btn-brand btn-sm">Publish</Submit></ActionForm>}
      </div>
      {qr && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal onClick={() => setQr(false)}>
          <div className="fade-up w-full max-w-xs rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><p className="font-semibold">QR Code undangan</p><button type="button" aria-label="Tutup" onClick={() => setQr(false)}><X size={18} /></button></div>
            <QrImage value={link} size={220} className="mx-auto my-4" />
            <p className="break-all text-xs text-stone-500">{link}</p>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => downloadQR(link, `qr-${inv.slug}`)}><Download size={16} /> Unduh PNG resolusi tinggi</button>
          </div>
        </div>)}
    </div>
  );
}
