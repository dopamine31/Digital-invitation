// Edge Function: kirim email transaksional via Resend. Dipanggil dari server, bukan dari browser.
Deno.serve(async (req) => {
  const { to, subject, text } = await req.json();
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: Deno.env.get("EMAIL_FROM"), to, subject, text }) });
  return new Response(await res.text(), { status: res.status });
});
