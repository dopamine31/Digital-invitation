import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, webhookHeaders, webhookSignature, WEBHOOK_EVENTS } from "@/lib/webhook";
import { sanitizeCss, sanitizeHeadMeta, sanitizeHtml } from "@/lib/sanitize";

describe("webhook & sanitizer", () => {
  it("signature HMAC valid dan menolak body yang diubah", () => {
    const secret = "whsec_test";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: "rsvp.created" });
    const signature = webhookSignature(secret, timestamp, body);
    expect(verifyWebhookSignature(secret, timestamp, body, `sha256=${signature}`)).toBe(true);
    expect(verifyWebhookSignature(secret, timestamp, `${body}x`, signature)).toBe(false);
    // Timestamp kedaluwarsa ditolak oleh jendela 5 menit.
    const stale = (Number(timestamp) - 3600).toString();
    expect(verifyWebhookSignature(secret, stale, body, webhookSignature(secret, stale, body))).toBe(false);
  });

  it("header webhook mencantumkan event & delivery", () => {
    const headers = webhookHeaders("secret", "{}", "order.paid", "del_1");
    expect(headers["X-Rasa-Event"]).toBe("order.paid");
    expect(headers["X-Rasa-Delivery"]).toBe("del_1");
    expect(WEBHOOK_EVENTS).toContain("guest.checked_in");
  });

  it("sanitizer membuang script, @import, dan fixed positioning", () => {
    expect(sanitizeHtml('<p onclick="alert(1)">Halo</p><script>alert(1)</script>')).toContain("<p>Halo</p>");
    expect(sanitizeHtml('<p onclick="alert(1)">Halo</p><script>alert(1)</script>')).not.toContain("<script");
    expect(sanitizeCss(".x { position: fixed; } @import url(https://evil.example);")).not.toMatch(/position:\s*fixed|@import/);
    expect(sanitizeHeadMeta('<meta name="description" content="Aman"><script>bad()</script>')).not.toContain("<script");
  });
});
