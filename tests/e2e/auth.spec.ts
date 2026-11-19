import { expect, test } from "@playwright/test";

test.describe("AUTH-01 — Giriş sayfası", () => {
  test("El At! başlığını ve Google butonunu gösterir", async ({ page }) => {
    await page.goto("/giris");

    await expect(
      page.getByRole("heading", { name: "El At!" }),
    ).toBeVisible();

    const googleButton = page.getByRole("button", {
      name: "Google ile devam et",
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
  });

  test("buton klavye ile odaklanabilir (44x44+ dokunma alanı)", async ({
    page,
  }) => {
    await page.goto("/giris");

    const googleButton = page.getByRole("button", {
      name: "Google ile devam et",
    });
    await googleButton.focus();
    await expect(googleButton).toBeFocused();

    const box = await googleButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("giriş izni reddedildiğinde anlaşılır bir mesaj gösterir", async ({
    page,
  }) => {
    await page.goto("/giris?error=AccessDenied");

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Giriş izni verilmedi",
    );
  });

  test("/aile girişsiz erişildiğinde /giris'e yönlendirir", async ({
    page,
  }) => {
    await page.goto("/aile");
    await expect(page).toHaveURL(/\/giris/);
  });

  test("Bugün ve aile raporu oturum gerektirir", async ({ page, request }) => {
    await page.goto("/bugun");
    await expect(page).toHaveURL(/\/giris/);
    await page.goto("/raporlar");
    await expect(page).toHaveURL(/\/giris/);
    const exportResponse = await request.get("/raporlar/indir", { maxRedirects: 0 });
    expect(exportResponse.status()).toBe(401);
  });

  test("ev planı aile oturumu gerektirir", async ({ page }) => {
    await page.goto("/ev");
    await expect(page).toHaveURL(/\/giris/);
    await expect(page.locator("[data-floor-plan-canvas]")).toHaveCount(0);
  });

  test("hızlı arama oturum olmadan aile kaydı döndürmez", async ({ request }) => {
    const response = await request.get("/api/ara?q=mutfak", { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toMatch(/no-store/);
    expect(await response.json()).toEqual({ results: [] });
  });

  test("Ben ekranı oturum gerektirir ve URL sahte silme bildirimi göstermez", async ({ page }) => {
    await page.goto("/ben");
    await expect(page).toHaveURL(/\/giris/);

    await page.goto("/giris?durum=hesap-silindi");
    await expect(page.getByText("El At! hesabın silindi.", { exact: true })).toHaveCount(0);
  });

  // Gerçek Google OAuth turunu dağıtım ortamında bir test hesabıyla doğrula.
});
