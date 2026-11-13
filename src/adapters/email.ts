import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tenantId?: string;
}

export interface EmailResult { ok: boolean; provider: string; messageId: string | null; response: Record<string, unknown>; error?: string }

export interface EmailAdapter { readonly name: string; send(message: EmailMessage): Promise<EmailResult> }

class MockEmailAdapter implements EmailAdapter {
  readonly name = "mock";
  async send(message: EmailMessage): Promise<EmailResult> {
    logger.info("[email mock] pesan tercatat", { to: message.to, subject: message.subject, tenantId: message.tenantId });
    return { ok: true, provider: "mock", messageId: `mock-mail-${Date.now()}`, response: { simulated: true } };
  }
}

class SmtpEmailAdapter implements EmailAdapter {
  readonly name = "smtp";
  async send(message: EmailMessage): Promise<EmailResult> {
    const config = env();
    const transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false,
      ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {}),
    });
    const info = await transport.sendMail({
      from: config.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? message.html.replace(/<[^>]+>/g, ""),
    });
    transport.close();
    return { ok: true, provider: "smtp", messageId: info.messageId, response: { accepted: info.accepted } };
  }
}

let cached: EmailAdapter | null = null;
export function emailAdapter(): EmailAdapter {
  if (cached) return cached;
  cached = env().EMAIL_ADAPTER === "smtp" ? new SmtpEmailAdapter() : new MockEmailAdapter();
  return cached;
}
