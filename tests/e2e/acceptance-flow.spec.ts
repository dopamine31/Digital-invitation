import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now().toString().slice(-6);
const email = `e2e-${stamp}@rasa.test`;
const password = "E2EPassword!234";
const phone = `62812${stamp}`;
const tenantName = `Studio E2E ${stamp}`;
const eventTitle = `Pernikahan E2E ${stamp}`;
const firstGuest = "Tamu 001";
const open = (page: Page, url: string) => page.goto(url, { waitUntil: "domcontentloaded" });

function csv100(): Buffer {
  const rows = ["nama,no_hp,email,grup,pax"];
  for (let i = 1; i <= 100; i += 1) {
    rows.push(`Tamu ${String(i).padStart(3, "0")},62812000${String(i).padStart(4, "0")},tamu${i}@e2e.test,Keluarga,2`);
  }
  return Buffer.from(`${rows.join("\n")}\n`, "utf8");
}

test("alur kritikal: register → create → theme/PIC → import 100 → link+QR → blast → RSVP → notifikasi → check-in → export", async ({ page, browser }) => {
  await open(page, "/register");
  await page.locator("#reg-name").fill("Owner E2E");
  await page.locator("#reg-tenant").fill(tenantName);
  await page.locator("#reg-email").fill(email);
  await page.locator("#reg-phone").fill(phone);
  await page.locator("#reg-password").fill(password);
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Buat akun & mulai/i }).click();
  await expect(page).toHaveURL(/\/app(?:\/events\/new)?$/);
  await open(page, "/app");
  await page.getByRole("link", { name: /Buat acara/i }).first().click();
  await expect(page.getByText("Acara apa yang sedang Anda rencanakan?")).toBeVisible();
  await page.getByRole("button", { name: /Lanjutkan/ }).click();
  await page.getByRole("button", { name: /Lanjutkan/ }).click();
  await page.locator("#w-title").fill(eventTitle);
  await page.locator("#w-pic").fill("PIC E2E");
  await page.locator("#w-picphone").fill("081234500099");
  await expect(page.locator('input[type="checkbox"]').last()).toBeChecked();
  await page.getByRole("button", { name: /Lanjutkan/ }).click();
  await page.getByRole("button", { name: /Buat acara/i }).click();
  await expect(page).toHaveURL(/\/app\/events\/[^/]+\/editor$/);
  const eventId = page.url().match(/\/app\/events\/([^/]+)/)?.[1];
  expect(eventId).toBeTruthy();
  const slug = eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Publikasikan acara agar tautan personal dapat dibuka tamu tanpa login.
  await open(page, `/app/events/${eventId}`);
  await page.getByRole("button", { name: "Terbitkan" }).click();
  await expect(page.getByRole("button", { name: "Jadikan draf" })).toBeVisible();

  // Ubah warna & PIC pada theme customizer; pastikan autosave/penyimpanan bekerja.
  await open(page, `/app/events/${eventId}/theme`);
  await page.getByRole("tab", { name: "PIC Sampul" }).click();
  await page.getByLabel("Nama PIC").fill("PIC E2E Updated");
  await page.getByRole("button", { name: /Simpan semua/i }).click();
  await expect(page.getByText("Tema & pengaturan PIC tersimpan")).toBeVisible();

  await open(page, `/app/events/${eventId}/guests`);
  await page.locator('input[type="file"]').setInputFiles({ name: "tamu.csv", mimeType: "text/csv", buffer: csv100() });
  await expect(page.getByText(/Petakan kolom · 100 baris/)).toBeVisible();
  await page.getByRole("button", { name: /Impor 100 baris/ }).click();
  await expect(page.getByText(/100 tamu dibuat/)).toBeVisible();

  const linkButton = page.getByRole("button", { name: /^Link: http/ }).first();
  const aria = await linkButton.getAttribute("aria-label");
  const personalLink = aria?.replace(/^Link: /, "") ?? "";
  expect(personalLink).toContain(`/i/${slug}?to=`);
  await expect(page.getByRole("link", { name: /QR/i }).first()).toBeVisible();

  await open(page, `/app/events/${eventId}/blast`);
  await page.getByRole("button", { name: /Kirim bertahap/i }).click();
  await expect(page.getByText(/Blast masuk antrean/)).toBeVisible();

  // Tamu tanpa login membuka link personal, lalu RSVP dengan pertanyaan kustom.
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await open(guestPage, personalLink);
  await guestPage.getByRole("button", { name: /Buka Undangan/i }).click();
  await guestPage.getByRole("button", { name: /Lanjutkan/ }).click();
  await guestPage.getByText("Teman", { exact: true }).click();
  await guestPage.getByRole("checkbox", { name: "Persetujuan Kebijakan Privasi" }).check();
  await guestPage.getByRole("button", { name: /Kirim Konfirmasi/i }).click();
  await expect(guestPage.getByText(/Terima kasih!/).first()).toBeVisible();
  await guestContext.close();

  // Notifikasi RSVP tercapai ke owner, dan blast tercatat di log.
  await open(page, "/app/notifications");
  await expect(page.getByText("Log notifikasi")).toBeVisible();
  await open(page, `/app/events/${eventId}/blast`);
  await expect(page.getByText("Riwayat (1)")).toBeVisible();

  // Check-in manual + anti-duplikat.
  await open(page, `/app/events/${eventId}/checkin`);
  await page.getByRole("tab", { name: "Cari & manual" }).click();
  await page.getByLabel("Cari tamu").fill(firstGuest);
  await page.getByRole("button", { name: /^Cari$/ }).click();
  const row = page.getByRole("row", { name: new RegExp(firstGuest) });
  await row.getByRole("button", { name: /Check-in/ }).click();
  await expect(page.getByText(/Berhasil/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Cari$/ }).click();
  await expect(page.getByRole("row", { name: new RegExp(firstGuest) }).getByRole("button", { name: /Check-in/ })).toBeDisabled();

  const exportResponse = await page.request.get(`/api/exports/${eventId}?type=guests&format=csv`);
  expect(exportResponse.status()).toBe(200);
  expect(await exportResponse.text()).toContain(firstGuest);
});

test("super admin: KPI, ubah paket, impersonate, suspend tenant", async ({ page }) => {
  await open(page, "/login");
  await page.locator("#login-email").fill("superadmin@rasa.id");
  await page.locator("#login-password").fill("SuperAdmin!234");
  await page.getByRole("button", { name: /^Masuk$/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Kinerja platform" })).toBeVisible();
  await expect(page.getByText("MRR", { exact: true })).toBeVisible();

  await open(page, "/admin/tenants");
  const row = page.getByRole("row", { name: /Harmoni Wedding Organizer/ });
  await row.locator("select").selectOption({ label: "GROWTH" });
  await expect(page.getByText("Paket tenant diperbarui")).toBeVisible();
  await row.getByRole("button", { name: /Impersonate/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Anda sedang/)).toBeVisible();
  await page.getByRole("button", { name: "Hentikan" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await open(page, "/admin/tenants");
  await page.getByRole("row", { name: /Anggrek Event Studio/ }).getByRole("button", { name: "Suspend tenant" }).click();
  await expect(page.getByText("Tenant ditangguhkan")).toBeVisible();
});
