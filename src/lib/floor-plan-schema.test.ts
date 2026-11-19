import { describe, expect, it } from "vitest";

import {
  floorPlanInputSchema,
  floorPlanShapesSchema,
  PLAN_HEIGHT,
  PLAN_MAX_SHAPES,
  PLAN_WIDTH,
} from "./floor-plan-schema";

const room = { id: "front_room", kind: "room", x: 0, y: 0, width: 4, height: 8, label: "  Salon  ", roomId: "area-1" };
const door = { id: "door-1", kind: "door", x1: 4, y1: 2, x2: 4, y2: 0 };

describe("saved home plan", () => {
  it("accepts linked rectangles and preserves segment direction", () => {
    const input = floorPlanInputSchema.parse({ familyId: "family-1", revision: 0, shapes: [room, door] });
    expect(input.shapes).toEqual([{ ...room, label: "Salon" }, door]);
  });

  it("accepts shapes at the edges of the drawing grid", () => {
    expect(floorPlanShapesSchema.safeParse([
      { ...room, x: PLAN_WIDTH - 4, y: PLAN_HEIGHT - 8 },
      { ...door, x1: PLAN_WIDTH, x2: PLAN_WIDTH, y1: PLAN_HEIGHT - 1, y2: PLAN_HEIGHT },
    ]).success).toBe(true);
  });

  it("rejects out-of-bounds, thin and fractional rooms", () => {
    for (const item of [
      { ...room, x: PLAN_WIDTH - 1 }, { ...room, y: PLAN_HEIGHT - 7 },
      { ...room, height: 1 }, { ...room, width: 2.5 },
    ]) expect(floorPlanShapesSchema.safeParse([item]).success).toBe(false);
  });

  it("rejects diagonal and zero-length segments", () => {
    expect(floorPlanShapesSchema.safeParse([{ ...door, x2: 5 }]).success).toBe(false);
    expect(floorPlanShapesSchema.safeParse([{ ...door, y2: 2 }]).success).toBe(false);
  });

  it("rejects duplicate identifiers, excessive shapes and opaque extra data", () => {
    expect(floorPlanShapesSchema.safeParse([room, { ...door, id: room.id }]).success).toBe(false);
    const oversized = Array.from({ length: PLAN_MAX_SHAPES + 1 }, (_, index) => ({ ...door, id: `line-${index}` }));
    expect(floorPlanShapesSchema.safeParse(oversized).success).toBe(false);
    expect(floorPlanShapesSchema.safeParse([{ ...room, extra: "unexpected" }]).success).toBe(false);
  });
});
