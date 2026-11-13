"use client";
import { useState } from "react";
import { ActionForm, Submit, useToast } from "@/components/ActionForm";
import { cancelOrderAction, simulatePayAction, uploadProofAction } from "@/server/actions/customer";
import { processImage } from "@/components/editor/fields";

export function OrderPay({ orderId, bank, demo, hasProof }: { orderId: number; bank: { name: string; number: string; holder: string }; demo: boolean; hasProof: boolean }) {
  const [proof, setProof] = useState("");
  const toast = useToast();
  const hid = <input type="hidden" name="orderId" value={orderId} />;
  return (
    <div className="space-y-4 no-print">
      <div className="card p-4"><h3 className="font-semibold">Transfer manual</h3>
        <p className="mt-2 text-sm">{bank.name} <b className="font-mono text-base">{bank.number}</b></p><p className="text-sm text-stone-500">a.n. {bank.holder}</p>
        <p className="mt-2 text-xs text-stone-500">Setelah transfer, unggah bukti pembayaran. Admin akan memverifikasi.</p>
        <ActionForm action={uploadProofAction} className="mt-3 space-y-3">
          {hid}<input type="hidden" name="proof" value={proof} />
          <select name="method" className="input" aria-label="Metode"><option value="transfer">Transfer Bank</option><option value="qris">QRIS</option><option value="ewallet">E-Wallet</option></select>
          <label className="btn btn-ghost w-full cursor-pointer">{proof ? "✓ Bukti dipilih (ganti)" : hasProof ? "Ganti bukti pembayaran" : "Pilih foto bukti"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setProof(await processImage(f, null, 1400, 0.8)); } catch (er) { toast((er as Error).message, "err"); } }} /></label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {proof && <img src={proof} alt="Pratinjau bukti" className="max-h-48 rounded-lg border" />}
          <Submit className="btn btn-primary w-full" disabled={!proof}>Kirim bukti pembayaran</Submit>
        </ActionForm>
      </div>
      {demo && (
        <div className="card border-dashed border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold text-amber-900">Mode demo</h3>
          <p className="mt-1 text-xs text-amber-800">Payment gateway belum dikonfigurasi. Simulasi ini TIDAK memproses uang sungguhan, hanya menandai pesanan lunas untuk uji alur.</p>
          <ActionForm action={simulatePayAction} className="mt-3">{hid}<Submit className="btn btn-brand w-full">Simulasi pembayaran berhasil</Submit></ActionForm></div>)}
      <ActionForm action={cancelOrderAction} confirm="Batalkan pesanan ini?">{hid}<Submit className="btn btn-ghost btn-sm text-red-600">Batalkan pesanan</Submit></ActionForm>
    </div>
  );
}
