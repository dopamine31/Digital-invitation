// Edge Function (Deno): webhook payment gateway. WAJIB memverifikasi signature sebelum mengubah status.
// Deploy: supabase functions deploy payment-webhook --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
  const raw = await req.text();
  const sig = req.headers.get("x-signature") ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret ?? ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!secret || mac !== sig) return new Response("invalid signature", { status: 401 });
  // Sesuaikan format dengan Midtrans/Xendit (Midtrans: SHA512(order_id+status_code+gross_amount+ServerKey))
  const evt = JSON.parse(raw);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (evt.status === "paid") await db.from("payments").update({ status: "berhasil" }).eq("reference", evt.reference);
  return new Response("ok");
});
