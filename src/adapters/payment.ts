import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { AppError, ok, err, type Result } from "@/lib/result";

export interface PaymentRequest {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  description: string;
  successUrl: string;
}

export interface PaymentSession {
  provider: string;
  reference: string;
  paymentUrl: string;
  expiresAt: Date | null;
  raw: Record<string, unknown>;
}

export interface PaymentEvent { invoiceId: string; status: "PAID" | "FAILED" | "PENDING"; provider: string; reference: string; raw: Record<string, unknown> }

export interface PaymentAdapter {
  readonly name: string;
  createSession(request: PaymentRequest): Promise<PaymentSession>;
  verifyWebhook(headers: Record<string, string>, rawBody: string): Result<PaymentEvent>;
}

class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock";
  async createSession(request: PaymentRequest): Promise<PaymentSession> {
    const appUrl = env().APP_URL;
    return {
      provider: "mock",
      reference: `MOCK-${request.invoiceNumber}`,
      paymentUrl: `${appUrl}/app/billing?mock_pay=${encodeURIComponent(request.invoiceId)}`,
      expiresAt: new Date(Date.now() + 24 * 3600_000),
      raw: { simulated: true },
    };
  }
  verifyWebhook(headers: Record<string, string>, rawBody: string): Result<PaymentEvent> {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const invoiceId = typeof parsed.invoiceId === "string" ? parsed.invoiceId : headers["x-invoice-id"];
    if (!invoiceId) return err("INVALID_WEBHOOK", "invoiceId tidak ada.");
    return ok({ invoiceId, status: "PAID", provider: "mock", reference: String(parsed.reference ?? ""), raw: parsed });
  }
}

function basicAuth(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

class MidtransAdapter implements PaymentAdapter {
  readonly name = "midtrans";
  async createSession(request: PaymentRequest): Promise<PaymentSession> {
    const config = env();
    if (!config.MIDTRANS_SERVER_KEY) throw new AppError("PROVIDER_CONFIG", "MIDTRANS_SERVER_KEY belum diisi.", 503);
    const base = config.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
    const response = await fetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: basicAuth(config.MIDTRANS_SERVER_KEY) },
      body: JSON.stringify({
        transaction_details: { order_id: request.invoiceNumber, gross_amount: request.amount },
        customer_details: { first_name: request.customerName, email: request.customerEmail },
        item_details: [{ id: request.invoiceId, price: request.amount, quantity: 1, name: request.description.slice(0, 50) }],
        callbacks: { finish: request.successUrl },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new AppError("PAYMENT_FAILED", `Midtrans: ${String(raw.error_messages ?? response.status)}`, 502);
    return {
      provider: "midtrans",
      reference: String(raw.token ?? ""),
      paymentUrl: `https://${config.MIDTRANS_IS_PRODUCTION === "true" ? "app" : "app.sandbox"}.midtrans.com/snap/v2/vtweb/${String(raw.token ?? "")}`,
      expiresAt: null,
      raw,
    };
  }
  verifyWebhook(headers: Record<string, string>, rawBody: string): Result<PaymentEvent> {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const signature = String(parsed.signature_key ?? "");
    const expected = createHmac("sha512", env().MIDTRANS_SERVER_KEY)
      .update(`${String(parsed.order_id ?? "")}${String(parsed.status_code ?? "")}${String(parsed.gross_amount ?? "")}${env().MIDTRANS_SERVER_KEY}`)
      .digest("hex");
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return err("INVALID_SIGNATURE", "Signature Midtrans tidak valid.");
    }
    const status = String(parsed.transaction_status ?? "");
    return ok({
      invoiceId: String(parsed.order_id ?? ""),
      status: ["capture", "settlement"].includes(status) ? "PAID" : ["deny", "cancel", "expire"].includes(status) ? "FAILED" : "PENDING",
      provider: "midtrans", reference: String(parsed.transaction_id ?? ""), raw: parsed,
    });
  }
}

class XenditAdapter implements PaymentAdapter {
  readonly name = "xendit";
  async createSession(request: PaymentRequest): Promise<PaymentSession> {
    const key = env().XENDIT_API_KEY;
    if (!key) throw new AppError("PROVIDER_CONFIG", "XENDIT_API_KEY belum diisi.", 503);
    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basicAuth(key) },
      body: JSON.stringify({
        external_id: request.invoiceId,
        amount: request.amount,
        description: request.description,
        payer_email: request.customerEmail,
        success_redirect_url: request.successUrl,
        currency: request.currency,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new AppError("PAYMENT_FAILED", `Xendit: ${String(raw.message ?? response.status)}`, 502);
    return { provider: "xendit", reference: String(raw.id ?? ""), paymentUrl: String(raw.invoice_url ?? ""), expiresAt: null, raw };
  }
  verifyWebhook(headers: Record<string, string>, rawBody: string): Result<PaymentEvent> {
    const token = headers["x-callback-token"] ?? "";
    const expected = env().XENDIT_WEBHOOK_TOKEN;
    if (!expected || !token || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return err("INVALID_SIGNATURE", "Xendit callback token tidak valid.");
    }
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return ok({
      invoiceId: String(parsed.external_id ?? ""),
      status: String(parsed.status ?? "") === "PAID" ? "PAID" : "PENDING",
      provider: "xendit", reference: String(parsed.id ?? ""), raw: parsed,
    });
  }
}

let cached: PaymentAdapter | null = null;
export function paymentAdapter(): PaymentAdapter {
  if (cached) return cached;
  switch (env().PAYMENT_ADAPTER) {
    case "midtrans": cached = new MidtransAdapter(); break;
    case "xendit": cached = new XenditAdapter(); break;
    default: cached = new MockPaymentAdapter();
  }
  return cached;
}
