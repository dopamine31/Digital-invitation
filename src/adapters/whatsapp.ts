import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/result";

export interface WhatsappMessage {
  to: string;
  body: string;
  tenantId?: string;
  templateKey?: string;
}

export interface ProviderResult {
  ok: boolean;
  provider: string;
  messageId: string | null;
  response: Record<string, unknown>;
  error?: string;
}

export interface WhatsappAdapter {
  readonly name: string;
  send(message: WhatsappMessage): Promise<ProviderResult>;
}

/** Adapter default: tidak mengirim ke luar, tetapi mencatat lengkap di log struktural. */
class MockWhatsappAdapter implements WhatsappAdapter {
  readonly name = "mock";
  async send(message: WhatsappMessage): Promise<ProviderResult> {
    const masked = `${message.to.slice(0, 5)}****${message.to.slice(-2)}`;
    logger.info("[WA mock] pesan tercatat", {
      to: masked,
      tenantId: message.tenantId,
      templateKey: message.templateKey,
      preview: message.body.slice(0, 90),
    });
    return {
      ok: true,
      provider: "mock",
      messageId: `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      response: { delivered: true, simulated: true, to: masked },
    };
  }
}

abstract class HttpWhatsappAdapter implements WhatsappAdapter {
  abstract readonly name: string;
  protected abstract endpoint(): string;
  protected abstract headers(): Record<string, string>;
  protected abstract payload(message: WhatsappMessage): Record<string, unknown>;

  async send(message: WhatsappMessage): Promise<ProviderResult> {
    const url = this.endpoint();
    if (!url) throw new AppError("PROVIDER_CONFIG", `Provider ${this.name} belum dikonfigurasi.`, 503);
    const isForm = this.name === "fonnte";
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: isForm
        ? new URLSearchParams(this.payload(message) as Record<string, string>).toString()
        : JSON.stringify(this.payload(message)),
      signal: AbortSignal.timeout(15_000),
    });
    const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: response.ok,
      provider: this.name,
      messageId: typeof raw.id === "string" ? raw.id : typeof raw.message_id === "string" ? raw.message_id : null,
      response: raw,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  }
}

class FonnteAdapter extends HttpWhatsappAdapter {
  readonly name = "fonnte";
  protected endpoint(): string { return "https://api.fonnte.com/send"; }
  protected headers(): Record<string, string> { return { Authorization: env().WHATSAPP_API_KEY }; }
  protected payload(message: WhatsappMessage): Record<string, unknown> { return { target: message.to, message: message.body }; }
}

class WatzapAdapter extends HttpWhatsappAdapter {
  readonly name = "watzap";
  protected endpoint(): string { return env().WHATSAPP_API_URL || "https://api.watzap.id/v1/send"; }
  protected headers(): Record<string, string> { return { "Content-Type": "application/json", Authorization: env().WHATSAPP_API_KEY }; }
  protected payload(message: WhatsappMessage): Record<string, unknown> { return { phone: message.to, message: message.body }; }
}

class MetaCloudAdapter extends HttpWhatsappAdapter {
  readonly name = "meta";
  protected endpoint(): string { return env().WHATSAPP_API_URL; }
  protected headers(): Record<string, string> { return { "Content-Type": "application/json", Authorization: `Bearer ${env().WHATSAPP_API_KEY}` }; }
  protected payload(message: WhatsappMessage): Record<string, unknown> {
    return {
      messaging_product: "whatsapp",
      to: message.to,
      type: "text",
      text: { preview_url: true, body: message.body },
    };
  }
}

let cached: WhatsappAdapter | null = null;
export function whatsappAdapter(): WhatsappAdapter {
  if (cached) return cached;
  switch (env().WHATSAPP_ADAPTER) {
    case "fonnte": cached = new FonnteAdapter(); break;
    case "watzap": cached = new WatzapAdapter(); break;
    case "meta": cached = new MetaCloudAdapter(); break;
    default: cached = new MockWhatsappAdapter();
  }
  return cached;
}
