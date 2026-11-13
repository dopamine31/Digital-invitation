import "server-only";

export type ChargeResult = { provider: string; reference: string; status: "pending" | "berhasil"; paymentUrl?: string; message: string };
export interface PaymentAdapter {
  name: string;
  live: boolean;
  createCharge(o: { orderNumber: string; amount: number; customerEmail: string }): Promise<ChargeResult>;
}

/** Mode demo — TIDAK memproses uang sungguhan. */
export const demoPayment: PaymentAdapter = {
  name: "demo", live: false,
  async createCharge(o) {
    return { provider: "demo", reference: `DEMO-${o.orderNumber}`, status: "berhasil", message: "Simulasi pembayaran (mode demo, tanpa uang sungguhan)." };
  },
};

/**
 * Kerangka Midtrans / Xendit. Aktif hanya jika kredensial server diisi.
 * Webhook wajib memverifikasi signature (lihat docs/SECURITY.md & supabase/functions/payment-webhook).
 */
const gatewayStub = (name: string, keyEnv: string): PaymentAdapter => ({
  name, live: Boolean(process.env[keyEnv]),
  async createCharge() {
    if (!process.env[keyEnv]) throw new Error(`${name} belum dikonfigurasi (isi ${keyEnv} di environment server).`);
    throw new Error(`Integrasi ${name} perlu diimplementasikan sesuai dokumentasi (lihat docs/DEPLOYMENT.md).`);
  },
});

export function getPaymentAdapter(provider = process.env.PAYMENT_PROVIDER || "demo"): PaymentAdapter {
  if (provider === "midtrans") return gatewayStub("Midtrans", "MIDTRANS_SERVER_KEY");
  if (provider === "xendit") return gatewayStub("Xendit", "XENDIT_SECRET_KEY");
  return demoPayment;
}
