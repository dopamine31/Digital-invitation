"use client";
import { useState } from "react";
import { ActionForm, Submit, useToast } from "@/components/ActionForm";
import { processImage } from "@/components/editor/fields";
import type { ActionResult } from "@/types";

type A = (fd: FormData) => Promise<ActionResult>;

export function NewTicketForm({ action }: { action: A }) {
  const [att, setAtt] = useState("");
  const toast = useToast();
  return (
    <ActionForm action={action} noRefresh onDone={() => setAtt("")} className="card space-y-3 p-4">
      <h2 className="font-semibold">Buat tiket baru</h2>
      <div><label className="label">Subjek</label><input name="subject" required minLength={4} maxLength={120} className="input" placeholder="Contoh: Cara mengganti template" /></div>
      <div><label className="label">Pesan</label><textarea name="body" required minLength={5} maxLength={2000} className="input" rows={4} /></div>
      <input type="hidden" name="attachment" value={att} />
      <label className="btn btn-ghost btn-sm cursor-pointer">{att ? "✓ Lampiran dipilih" : "Lampirkan gambar (opsional)"}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setAtt(await processImage(f, null, 1000, 0.7)); } catch (er) { toast((er as Error).message, "err"); } }} /></label>
      <div><Submit className="btn btn-primary">Kirim tiket</Submit></div>
    </ActionForm>
  );
}

export function ReplyForm({ action, ticketId, withStatus }: { action: A; ticketId: number; withStatus?: boolean }) {
  return (
    <ActionForm action={action} resetOnSuccess className="card space-y-3 p-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea name="body" required className="input" rows={3} maxLength={2000} placeholder="Tulis balasan…" aria-label="Balasan" />
      <div className="flex flex-wrap items-center gap-2">
        <Submit className="btn btn-primary">Kirim balasan</Submit>
        {withStatus && <select name="status" className="input !w-auto" aria-label="Status tiket" defaultValue="dibalas"><option value="dibalas">Tandai dibalas</option><option value="open">Tetap terbuka</option><option value="selesai">Selesaikan tiket</option></select>}
      </div>
    </ActionForm>
  );
}
