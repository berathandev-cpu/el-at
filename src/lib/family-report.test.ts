import { describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({ prisma: {} }));

import { familyReportCsv } from "./family-report";

describe("weekly report CSV", () => {
  const entry = {
    id: "entry",
    earnedAt: new Date("2026-11-22T21:00:00.000Z"),
    userId: "member",
    person: "İpek",
    task: 'Masa; "düzenle"',
    room: "Mutfak",
    points: 20,
  };

  it("keeps Turkish text, quotes delimiters and leaves points numeric", () => {
    const csv = familyReportCsv([entry]);
    expect(csv).toMatch(/^\uFEFF"Onay zamanı \(İstanbul\)";/u);
    expect(csv).toContain('"23.11.2026 00:00";"İpek";"Masa; ""düzenle""";"Mutfak";20\r\n');
  });

  it("neutralizes formulas in user-controlled fields after leading whitespace", () => {
    const csv = familyReportCsv([{ ...entry, person: "=1+1", task: "\u200B @SUM(1)", room: "\t-X" }]);
    expect(csv).toContain(`"'=1+1";"'\u200B @SUM(1)";"'\t-X";20`);
    expect(familyReportCsv([{ ...entry, person: "＝1+1" }])).toContain(`"'＝1+1"`);
  });

  it.each([
    ["en", '"Approval time (Istanbul)";"Member";"Task";"Area";Points'],
    ["zh", '"审核时间（伊斯坦布尔）";"成员";"任务";"区域";积分'],
  ] as const)("localizes CSV headings and preserves escaped data for %s", (language, header) => {
    const csv = familyReportCsv([{ ...entry, person: "＝1+1" }], language);
    expect(csv.startsWith(`\uFEFF${header}\r\n`)).toBe(true);
    expect(csv).toContain(`;"'＝1+1";"Masa; ""düzenle""";"Mutfak";20\r\n`);
  });
});
