import { describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({ prisma: { $queryRaw: vi.fn().mockResolvedValue([]) } }));

import { normalizeFamilySearchQuery, searchFamily } from "./family-search";
import { prisma } from "./prisma";

describe("family search", () => {
  it("folds Turkish letters, including all dotted and dotless I forms", () => {
    expect(normalizeFamilySearchQuery("  ÇAMAŞIR IŞIK İŞ ÖLÇÜ  ")).toBe("camasir isik is olcu");
    expect(normalizeFamilySearchQuery("çamaşır")).toBe("camasir");
    expect(normalizeFamilySearchQuery("I\u0307S\u0327")).toBe("is");
    expect(normalizeFamilySearchQuery("MUTFAK")).toBe("mutfak");
  });

  it("keeps SQL pattern characters literal and bounds Unicode input", () => {
    expect(normalizeFamilySearchQuery("%_")).toBe("%_");
    expect(normalizeFamilySearchQuery("a".repeat(80))).toBe("a".repeat(80));
    expect(normalizeFamilySearchQuery("a".repeat(81))).toBeNull();
    expect(normalizeFamilySearchQuery("🙂")).toBeNull();
    expect(normalizeFamilySearchQuery("🙂👍")).toBe("🙂👍");
    expect(normalizeFamilySearchQuery("a\u0000b")).toBeNull();
  });

  it("never queries storage for an incomplete or overlong term", async () => {
    vi.mocked(prisma.$queryRaw).mockClear();
    await expect(searchFamily("signed-in-user", " c ")).resolves.toEqual([]);
    await expect(searchFamily("signed-in-user", "a".repeat(81))).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["en", "Room", "Open to the family"],
    ["zh", "房间", "全家可领取"],
  ] as const)("localizes search details while preserving authored titles for %s", async (language, roomLabel, taskLabel) => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "room", kind: "room", title: "Mutfak", state: "ROOM" },
      { id: "task", kind: "task", title: "Mutfağı düzenle", roomName: "Mutfak", state: "OPEN", openToClaim: true },
    ]);

    await expect(searchFamily("signed-in-user", "mutfak", language)).resolves.toMatchObject([
      { title: "Mutfak", detail: roomLabel },
      { title: "Mutfağı düzenle", detail: `Mutfak · ${taskLabel}` },
    ]);
  });
});
