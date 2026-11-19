import {
  PLAN_HEIGHT,
  PLAN_WIDTH,
  type FloorPlanKind,
  type FloorPlanShape,
} from "@/lib/floor-plan-schema";

export type Point = { x: number; y: number };

export const GRID_PER_METER = 4;
export const TOOL_LABELS = {
  room: "Oda",
  wall: "Duvar",
  door: "Kapı",
  window: "Pencere",
} satisfies Record<FloorPlanKind, string>;

export function planRoomLabel(shape: { label: string; roomId: string | null }, defaultLabel: string): string {
  return !shape.roomId && shape.label === TOOL_LABELS.room ? defaultLabel : shape.label;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function snapPoint({ x, y }: Point): Point {
  return { x: clamp(Math.round(x), 0, PLAN_WIDTH), y: clamp(Math.round(y), 0, PLAN_HEIGHT) };
}

export function drawShape(kind: FloorPlanKind, id: string, start: Point, end: Point): FloorPlanShape | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (kind === "room") {
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) return null;
    return {
      id, kind, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(dx), height: Math.abs(dy), label: TOOL_LABELS.room, roomId: null,
    };
  }
  if (dx === 0 && dy === 0) return null;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  return { id, kind, x1: start.x, y1: start.y, x2: horizontal ? end.x : start.x, y2: horizontal ? start.y : end.y };
}

export function moveShape(shape: FloorPlanShape, from: Point, to: Point): FloorPlanShape {
  const isRoom = shape.kind === "room";
  const minX = isRoom ? shape.x : Math.min(shape.x1, shape.x2);
  const minY = isRoom ? shape.y : Math.min(shape.y1, shape.y2);
  const maxX = isRoom ? shape.x + shape.width : Math.max(shape.x1, shape.x2);
  const maxY = isRoom ? shape.y + shape.height : Math.max(shape.y1, shape.y2);
  const dx = clamp(to.x - from.x, -minX, PLAN_WIDTH - maxX);
  const dy = clamp(to.y - from.y, -minY, PLAN_HEIGHT - maxY);
  if (dx === 0 && dy === 0) return shape;

  if (isRoom) return { ...shape, x: shape.x + dx, y: shape.y + dy };
  return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
}
