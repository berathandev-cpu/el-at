import { expect, test } from "@playwright/test";

test("açık ve koyu görünüm yeni paletin renklerini kullanır", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/giris");

  async function color(token: string) {
    return page.evaluate((name) => {
      const sample = document.createElement("span");
      sample.style.color = `var(${name})`;
      document.body.append(sample);
      const result = getComputedStyle(sample).color;
      sample.remove();
      return result;
    }, token);
  }

  await expect.poll(() => color("--color-board")).toBe("rgb(239, 232, 221)");
  expect(await color("--palette-teal")).toBe("rgb(118, 171, 174)");
  expect(await color("--color-ink")).toBe("rgb(48, 56, 65)");
  expect(await color("--accent-fill")).toBe("rgb(255, 87, 34)");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => color("--color-paper")).toBe("rgb(48, 56, 65)");
  expect(await color("--accent-fill")).toBe("rgb(255, 87, 34)");
});
