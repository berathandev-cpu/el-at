import { expect, test } from "@playwright/test";

test("manifest ve kurulum simgeleri kullanılabilir", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: expect.stringContaining("El At!"), start_url: "/", display: "standalone" });
  expect(manifest.icons).toHaveLength(2);

  for (const size of [192, 512]) {
    const icon = manifest.icons.find(({ sizes }: { sizes: string }) => sizes === `${size}x${size}`);
    const image = await request.get(icon.src);
    expect(image.headers()["content-type"]).toContain("image/png");
    const png = await image.body();
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
});
