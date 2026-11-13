import "server-only";

export type EmailMessage = { to: string; subject: string; text: string };
export interface EmailAdapter { send(msg: EmailMessage): Promise<{ delivered: boolean; mode: string }> }

/** Mode demo: hanya mencatat ke log server. Ganti dengan Resend/SMTP/Supabase Edge Function di produksi. */
const demoAdapter: EmailAdapter = {
  async send(msg) {
    if (process.env.NODE_ENV !== "production") console.log(`[email:demo] -> ${msg.to}: ${msg.subject}`);
    return { delivered: false, mode: "demo" };
  },
};

/** Contoh integrasi Resend (aktif jika RESEND_API_KEY & EMAIL_FROM diisi). */
const resendAdapter: EmailAdapter = {
  async send(msg) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text }),
    });
    return { delivered: res.ok, mode: "resend" };
  },
};

export const getEmailAdapter = (): EmailAdapter => (process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? resendAdapter : demoAdapter);
export const sendEmail = (msg: EmailMessage) => getEmailAdapter().send(msg);
