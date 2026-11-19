import { describe, expect, it } from "vitest";

import { generatePublicId, isValidPublicId } from "./id";

describe("generatePublicId", () => {
  it("#ID + 13 haneli formatı üretir", () => {
    const id = generatePublicId();
    expect(id).toMatch(/^#ID\d{13}$/);
  });

  it("isValidPublicId ile tutarlıdır", () => {
    const id = generatePublicId();
    expect(isValidPublicId(id)).toBe(true);
  });

  it("art arda üretilen kimlikler pratikte çakışmaz", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generatePublicId()));
    expect(ids.size).toBe(2000);
  });
});

describe("isValidPublicId", () => {
  it("# öneki eksikse reddeder", () => {
    expect(isValidPublicId("ID4839201938483")).toBe(false);
  });

  it("hane sayısı yanlışsa reddeder", () => {
    expect(isValidPublicId("#ID123")).toBe(false);
    expect(isValidPublicId("#ID48392019384830000")).toBe(false);
  });

  it("küçük harfli öneki reddeder", () => {
    expect(isValidPublicId("#id4839201938483")).toBe(false);
  });

  it("doc'taki örnek formatı kabul eder", () => {
    expect(isValidPublicId("#ID4839201938483")).toBe(true);
  });
});
