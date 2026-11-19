import { expect, test, type Locator } from "@playwright/test";

async function readMaterial(panel: Locator) {
  return panel.evaluate((element) => {
    const style = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Panelin saydamlığı ölçülemedi.");
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return {
      backdrop: style.backdropFilter,
      opacity: context.getImageData(0, 0, 1, 1).data[3],
    };
  });
}

test("giriş paneli saydamlığı ve kontrast tercihlerini izler", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Tercihleri ayrı ayrı taklit etmek için Chromium CDP kullanılır.");

  await page.emulateMedia({ colorScheme: "light", contrast: "no-preference" });
  await page.goto("/giris");
  const panel = page.getByRole("region", { name: "Aile panonu aç" });
  await expect(panel).toBeVisible();
  const regular = await readMaterial(panel);
  expect(regular.backdrop).toContain("blur(");
  expect(regular.opacity).toBeGreaterThan(0);
  expect(regular.opacity).toBeLessThan(255);

  const cdp = await page.context().newCDPSession(page);
  for (const [preference, value] of [
    ["prefers-reduced-transparency", "reduce"],
    ["prefers-contrast", "more"],
  ] as const) {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: "light" },
        { name: "prefers-reduced-transparency", value: "no-preference" },
        { name: "prefers-contrast", value: "no-preference" },
      ].map((feature) => feature.name === preference ? { name: preference, value } : feature),
    });
    expect(await page.evaluate((query) => matchMedia(query).matches, `(${preference}: ${value})`)).toBeTruthy();
    await expect.poll(() => readMaterial(panel)).toEqual({ backdrop: "none", opacity: 255 });
  }
});
