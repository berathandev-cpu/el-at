import { z } from "zod";

export const PLAN_WIDTH = 60;
export const PLAN_HEIGHT = 40;
export const PLAN_MAX_SHAPES = 150;
export const PLAN_MAX_LABEL_LENGTH = 40;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const x = z.number().int().min(0).max(PLAN_WIDTH);
const y = z.number().int().min(0).max(PLAN_HEIGHT);

const room = z.strictObject({
  id,
  kind: z.literal("room"),
  x,
  y,
  width: z.number().int().min(2).max(PLAN_WIDTH),
  height: z.number().int().min(2).max(PLAN_HEIGHT),
  label: z.string().trim().min(1).max(PLAN_MAX_LABEL_LENGTH),
  roomId: id.nullable(),
});

const segment = z.strictObject({
  id,
  kind: z.enum(["wall", "door", "window"]),
  x1: x,
  y1: y,
  x2: x,
  y2: y,
});

const shape = z.discriminatedUnion("kind", [room, segment]).refine((item) => {
  if (item.kind === "room") {
    return item.x + item.width <= PLAN_WIDTH && item.y + item.height <= PLAN_HEIGHT;
  }
  return (item.x1 === item.x2) !== (item.y1 === item.y2);
}, "Çizgiler yatay veya dikey olmalı, odalar planın sınırları içinde kalmalı.");

export const floorPlanShapesSchema = z.array(shape)
  .max(PLAN_MAX_SHAPES)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Plan öğeleri benzersiz olmalı.");

export const floorPlanInputSchema = z.strictObject({
  familyId: id,
  revision: z.number().int().min(0).max(2_147_483_646),
  shapes: floorPlanShapesSchema,
});

export type FloorPlanShape = z.infer<typeof shape>;
export type FloorPlanKind = FloorPlanShape["kind"];
export type FloorPlanInput = z.infer<typeof floorPlanInputSchema>;
