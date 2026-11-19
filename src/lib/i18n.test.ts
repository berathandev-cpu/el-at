import { describe, expect, it } from "vitest";
import { createTranslator, getLocale, isLanguage } from "./i18n";
import { isTheme } from "./preference-values";

describe("display preferences", () => {
  it("accepts only supported languages and themes", () => {
    expect(isLanguage("zh")).toBe(true);
    expect(isLanguage("ja")).toBe(false);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("dark light")).toBe(false);
    expect(getLocale("zh")).toBe("zh-CN");
  });

  it("keeps Turkish and user-supplied names unchanged", () => {
    expect(createTranslator("tr")("Bugün")).toBe("Bugün");
    expect(createTranslator("en")("Bugün")).toBe("Today");
    expect(createTranslator("zh")("Görünüm ve dil")).toBe("外观和语言");
    expect(createTranslator("en")("İnci’nin özel odası")).toBe("İnci’nin özel odası");
  });

  it("only substitutes provided named values after translation", () => {
    expect(createTranslator("zh")("test {name}, {count}", { name: "İnci", count: 2 })).toBe("test İnci, 2");
    expect(createTranslator("en")("test {missing}", {})).toBe("test {missing}");
  });
});
