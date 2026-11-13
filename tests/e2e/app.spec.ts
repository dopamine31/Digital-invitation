import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, pw: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(pw);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("publik", () => {
  test("homepage & katalog 30+ template + pencarian", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/templates");
    expect(await page.locator("a[href^='/templates/']").count()).toBeGreaterThanOrEqual(30);
    await page.getByLabel("Cari template").fill("islami");
    await expect(page).toHaveURL(/q=islami/);
    expect(await page.locator("a[href^='/templates/']").count()).toBeLessThan(10);
  });
  test("detail template menampilkan demo", async ({ page }) => {
    await page.goto("/templates/luxury-gold");
    await expect(page.getByRole("heading", { name: "Luxury Gold" })).toBeVisible();
    await expect(page.locator("iframe[title^='Demo']")).toBeVisible();
  });
});

test.describe("auth & role", () => {
  test("login salah ditolak", async ({ page }) => {
    await login(page, "customer@demo.id", "salah-banget");
    await expect(page.getByText("Email atau kata sandi salah")).toBeVisible();
  });
  test("customer tidak bisa membuka admin", async ({ page }) => {
    await login(page, "customer@demo.id", "customer123");
    await expect(page).toHaveURL(/\/app/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app/);
  });
  test("owner masuk dashboard admin & staff dibatasi", async ({ page }) => {
    await login(page, "owner@demo.id", "owner123");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Dashboard Owner" })).toBeVisible();
    await page.context().clearCookies();
    await login(page, "staff@demo.id", "staff123");
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin(\?denied=1)?$/);
    await page.goto("/admin/templates");
    await expect(page).toHaveURL(/denied=1/);
  });
  test("route privat tanpa login diarahkan ke login", async ({ page }) => {
    await page.goto("/app/orders");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("undangan publik", () => {
  test("link personal, buka undangan, RSVP, ucapan, hadiah", async ({ page }) => {
    await page.goto("/i/andi-dan-siti?to=Bapak%20Budi");
    await expect(page.getByText("Bapak Budi").first()).toBeVisible();
    await page.getByTestId("open-invitation").click();
    await expect(page.getByTestId("countdown")).toBeVisible();
    await page.getByLabel("Nama", { exact: true }).first().fill("Penguji E2E");
    await page.getByRole("button", { name: "Kirim RSVP" }).click();
    await expect(page.getByText(/tercatat|Terima kasih/).first()).toBeVisible();
    const wish = page.getByTestId("wish-form");
    await wish.getByLabel("Nama").fill("Penguji");
    await wish.getByLabel("Ucapan").fill("Selamat berbahagia dari E2E");
    await wish.getByRole("button", { name: "Kirim Ucapan" }).click();
    await expect(page.getByText("Selamat berbahagia dari E2E").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Salin Nomor/ }).first()).toBeVisible();
  });
  test("draft tidak dapat dibuka publik", async ({ page }) => {
    await page.goto("/i/aqiqah-aisyah");
    await expect(page.getByText("Undangan belum tersedia")).toBeVisible();
  });
});

test.describe("alur customer baru", () => {
  test("daftar → template gratis → editor autosave → publish → publik", async ({ page }) => {
    const email = `e2e${Date.now()}@contoh.id`;
    await page.goto("/register");
    await page.getByLabel("Nama lengkap").fill("Penguji Baru");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Kata sandi").fill("rahasia123");
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/templates/modern-minimalist");
    await page.getByTestId("choose-template").click();
    await expect(page.getByTestId("total")).toHaveText("Gratis");
    await page.getByRole("button", { name: "Buat undangan gratis" }).click();
    await expect(page).toHaveURL(/\/edit/, { timeout: 15000 });
    await page.getByLabel("Judul / kepala undangan").fill("Pesta Uji Coba");
    await expect(page.getByText(/Tersimpan/)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 10000 });
  });

  test("checkout premium + voucher + simulasi pembayaran", async ({ page }) => {
    await login(page, "customer@demo.id", "customer123");
    await expect(page).toHaveURL(/\/app/);
    await page.goto("/app/checkout?template=floral-romantic");
    await page.getByRole("button", { name: /Premium/ }).first().click();
    await page.getByLabel("Kode voucher").fill("HEMAT10");
    await page.getByRole("button", { name: "Pakai" }).click();
    await expect(page.getByText("Voucher berhasil dipakai.")).toBeVisible();
    await page.getByRole("button", { name: "Buat pesanan" }).click();
    await expect(page).toHaveURL(/\/app\/orders\/\d+/, { timeout: 15000 });
    await page.getByRole("button", { name: "Simulasi pembayaran berhasil" }).click();
    await expect(page.getByText(/Dibayar/).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("responsif tanpa horizontal overflow", () => {
  for (const w of [320, 375, 414, 768, 1280]) {
    test(`lebar ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      for (const url of ["/", "/templates", "/login", "/i/andi-dan-siti"]) {
        await page.goto(url);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${url} @${w}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
