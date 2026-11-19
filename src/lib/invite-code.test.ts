import { describe, expect, it } from "vitest";

import {
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from "./invite-code";

describe("generateInviteCode", () => {
  it("ELAT- öneki + 5 karakter üretir", () => {
    expect(generateInviteCode()).toMatch(/^ELAT-[A-Z2-9]{5}$/);
  });

  it("isValidInviteCode ile tutarlıdır", () => {
    expect(isValidInviteCode(generateInviteCode())).toBe(true);
  });

  it("karıştırılması kolay karakterleri (0 O 1 I L) kullanmaz", () => {
    // Sadece rastgele kısmı kontrol ediyoruz; "ELAT-" öneki sabit ve
    // içinde zaten L harfi var.
    const randomParts = Array.from({ length: 500 }, () =>
      generateInviteCode().slice("ELAT-".length),
    ).join("");
    expect(randomParts).not.toMatch(/[01OIL]/);
  });

  it("art arda üretilen kodlar pratikte çakışmaz", () => {
    const codes = new Set(Array.from({ length: 300 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(290);
  });
});

describe("normalizeInviteCode", () => {
  it("küçük harfi büyütür", () => {
    expect(normalizeInviteCode("elat-7h29k")).toBe("ELAT-7H29K");
  });

  it("baştaki/sondaki ve aradaki boşlukları temizler", () => {
    expect(normalizeInviteCode("  ELAT- 7H29K ")).toBe("ELAT-7H29K");
  });
});

describe("isValidInviteCode", () => {
  it("doc'taki örnek kodu kabul eder", () => {
    expect(isValidInviteCode("ELAT-7H29K")).toBe(true);
  });

  it("yanlış öneki reddeder", () => {
    expect(isValidInviteCode("ELAT7H29K")).toBe(false);
    expect(isValidInviteCode("ELATT-7H29K")).toBe(false);
  });

  it("yanlış uzunluğu reddeder", () => {
    expect(isValidInviteCode("ELAT-7H29")).toBe(false);
    expect(isValidInviteCode("ELAT-7H29KK")).toBe(false);
  });
});
