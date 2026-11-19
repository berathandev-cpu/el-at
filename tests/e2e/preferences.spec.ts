import { expect, test, type Page } from "@playwright/test";

async function openPreferences(page: Page) {
  const settings = page.locator("details").filter({ has: page.locator('select[name="language"]') });
  if (await settings.getAttribute("open") === null) await settings.locator("summary").click();
  return settings;
}

test("girişte dil ve tema seçilir, yenilemede ve diğer sayfalarda korunur", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/giris");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "tr-TR");
  const settings = await openPreferences(page);
  await settings.getByLabel("Dil").selectOption("en");
  await settings.getByLabel("Tema").selectOption("dark");
  await settings.getByRole("button", { name: "Kaydet", exact: true }).click();

  await expect(html).toHaveAttribute("lang", "en-US");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(36, 43, 49)");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await page.goto("/giris?error=AccessDenied");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Sign-in permission was denied.");

  await page.emulateMedia({ colorScheme: "dark" });
  const inEnglish = await openPreferences(page);
  await inEnglish.getByLabel("Language").selectOption("zh");
  await inEnglish.getByLabel("Theme").selectOption("light");
  await inEnglish.getByRole("button", { name: "Save", exact: true }).click();
  await expect(html).toHaveAttribute("lang", "zh-CN");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(239, 232, 221)");
  await expect(page.getByRole("button", { name: "使用 Google 账号继续" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "打开家庭看板" })).toBeVisible();
  await expect(html).toHaveAttribute("data-theme", "light");

  const manifest = await page.request.get("/manifest.webmanifest");
  expect((await manifest.json()).lang).toBe("zh-CN");
});
