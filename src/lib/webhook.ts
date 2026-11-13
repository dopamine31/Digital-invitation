import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_EVENTS = ["rsvp.created", "rsvp.updated", "guest.checked_in", "order.paid"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function webhookSignature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhookSignature(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = webhookSignature(secret, timestamp, body);
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature.replace(/^sha256=/, ""), "utf8");
  if (left.length !== right.length) return false;
  const fresh = Math.abs(Date.now() - Number(timestamp) * 1000) < 5 * 60 * 1000;
  return fresh && timingSafeEqual(left, right);
}

export function webhookHeaders(secret: string, body: string, event: WebhookEvent, id: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    "Content-Type": "application/json",
    "X-Rasa-Event": event,
    "X-Rasa-Delivery": id,
    "X-Rasa-Timestamp": timestamp,
    "X-Rasa-Signature": `sha256=${webhookSignature(secret, timestamp, body)}`,
  };
}
