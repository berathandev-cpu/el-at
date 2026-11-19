"use client";

import type { Ref, SVGProps } from "react";
import { useTranslations } from "@/lib/i18n-client";

import { planRoomLabel, TOOL_LABELS } from "./floor-plan-editor-geometry";

import { PLAN_HEIGHT, PLAN_WIDTH, type FloorPlanShape } from "@/lib/floor-plan-schema";

type RoomShape = Extract<FloorPlanShape, { kind: "room" }>;
type SegmentShape = Exclude<FloorPlanShape, RoomShape>;
type DrawingEvents = Pick<
  SVGProps<SVGSVGElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture"
>;

type Props = DrawingEvents & {
  shapes: FloorPlanShape[];
  rooms: { id: string; name: string }[];
  canvasRef?: Ref<SVGSVGElement>;
  selectedId?: string | null;
  draft?: FloorPlanShape | null;
  editing?: boolean;
  className?: string;
};

const paper = "var(--plan-paper)";
const structure = "var(--plan-ink)";
const emphasis = "var(--plan-accent)";
const windowInk = "var(--plan-accent)";

function gridPath(major: boolean) {
  const divisions = (length: number) => Array.from({ length: length + 1 }, (_, step) => step)
    .filter((step) => (step % 4 === 0) === major);

  return [
    ...divisions(PLAN_WIDTH).map((x) => `M ${x} 0 V ${PLAN_HEIGHT}`),
    ...divisions(PLAN_HEIGHT).map((y) => `M 0 ${y} H ${PLAN_WIDTH}`),
  ].join(" ");
}

const minorGrid = gridPath(false);
const metreGrid = gridPath(true);

function RoomDrawing({
  room,
  roomName,
  selected,
  editing,
}: {
  room: RoomShape;
  roomName: string | undefined;
  selected: boolean;
  editing: boolean;
}) {
  const { t, locale } = useTranslations();
  const { x, y, width, height } = room;
  const dimensions = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const name = planRoomLabel(room, t(TOOL_LABELS.room)) || roomName || t(TOOL_LABELS.room);
  const fontSize = width < 7 || height < 4 ? 0.95 : 1.45;
  const limit = Math.max(1, Math.floor((width - 0.7) / (fontSize * 0.64)));
  const letters = Array.from(name);
  const shownName = letters.length <= limit ? name : `${letters.slice(0, limit - 1).join("")}…`;
  const showMeasurements = width >= 8 && height >= 6;
  const centre = x + width / 2;
  const baseline = y + height / 2 + (showMeasurements ? -0.3 : fontSize * 0.32);
  const linkedRoomId = !editing && roomName ? room.roomId : null;

  const drawing = (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={selected ? "var(--plan-selected)" : "var(--plan-room)"}
        fillOpacity={0.9}
        stroke={selected ? emphasis : structure}
        strokeWidth={selected ? 0.56 : 0.34}
        className={linkedRoomId ? "group-hover/floor-room:fill-[var(--plan-selected)] group-focus-visible/floor-room:stroke-[var(--plan-accent)] group-focus-visible/floor-room:stroke-[0.64]" : undefined}
      />
      <text
        x={centre}
        y={baseline}
        textAnchor="middle"
        fill={structure}
        fontSize={fontSize}
        fontWeight={700}
        textDecoration={linkedRoomId ? "underline" : undefined}
        pointerEvents="none"
      >
        {shownName}
      </text>
      {showMeasurements && (
        <text
          x={centre}
          y={baseline + 1.4}
          textAnchor="middle"
          fill="var(--plan-ink)"
          fontSize={0.85}
          pointerEvents="none"
        >
          {t("{width} × {height} m", { width: dimensions.format(width / 4), height: dimensions.format(height / 4) })}
        </text>
      )}
    </>
  );

  return (
    <g data-shape-id={room.id} data-shape-kind="room">
      {linkedRoomId ? (
        <a
          href={`/gorevler?alan=${encodeURIComponent(linkedRoomId)}`}
          className="group/floor-room"
          tabIndex={0}
          aria-label={t("{room} görevlerini aç", { room: roomName ?? "" })}
          data-floor-room-link={linkedRoomId}
        >
          <title>{name}</title>
          {drawing}
        </a>
      ) : (
        <>
          <title>{name}</title>
          {drawing}
        </>
      )}
    </g>
  );
}

function SegmentDrawing({
  shape,
  selected,
  allowHit,
}: {
  shape: SegmentShape;
  selected: boolean;
  allowHit: boolean;
}) {
  const { t } = useTranslations();
  const { x1, y1, x2, y2, kind } = shape;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const line = { x1, y1, x2, y2 };
  const offsetX = length ? -dy / length * 0.18 : 0;
  const offsetY = length ? dx / length * 0.18 : 0;

  return (
    <g data-shape-id={shape.id} data-shape-kind={kind}>
      <title>{t(TOOL_LABELS[kind])}</title>
      {selected && <line {...line} stroke={emphasis} strokeWidth={1.1} strokeOpacity={0.42} />}
      {kind === "wall" && (
        <line {...line} stroke={selected ? emphasis : structure} strokeWidth={0.54} strokeLinecap="square" />
      )}
      {kind === "door" && (
        <g fill="none" stroke={selected ? emphasis : structure}>
          <line {...line} stroke={paper} strokeWidth={0.69} />
          <path d={`M ${x1} ${y1} L ${x1 - dy} ${y1 + dx} A ${length} ${length} 0 0 0 ${x2} ${y2}`} strokeWidth={0.14} />
          <circle cx={x1} cy={y1} r={0.21} fill={selected ? emphasis : structure} stroke="none" />
        </g>
      )}
      {kind === "window" && (
        <g stroke={selected ? emphasis : windowInk} strokeWidth={0.13}>
          <line {...line} stroke={paper} strokeWidth={0.69} />
          <line x1={x1 + offsetX} y1={y1 + offsetY} x2={x2 + offsetX} y2={y2 + offsetY} />
          <line x1={x1 - offsetX} y1={y1 - offsetY} x2={x2 - offsetX} y2={y2 - offsetY} />
          <line x1={x1 + offsetX} y1={y1 + offsetY} x2={x1 - offsetX} y2={y1 - offsetY} />
          <line x1={x2 + offsetX} y1={y2 + offsetY} x2={x2 - offsetX} y2={y2 - offsetY} />
        </g>
      )}
      {allowHit && <line {...line} stroke="transparent" strokeWidth={1.8} strokeLinecap="round" pointerEvents="stroke" />}
    </g>
  );
}

export function FloorPlanCanvas({
  shapes,
  rooms,
  canvasRef,
  selectedId,
  draft,
  editing = false,
  className = "",
  ...events
}: Props) {
  const { t } = useTranslations();
  const roomNames = new Map(rooms.map(({ id, name }) => [id, name]));
  const drawnRooms = shapes.filter((shape): shape is RoomShape => shape.kind === "room");
  const walls = shapes.filter((shape): shape is SegmentShape => shape.kind === "wall");
  const openings = shapes.filter((shape): shape is SegmentShape => shape.kind === "door" || shape.kind === "window");

  return (
    <svg
      {...events}
      ref={canvasRef}
      viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`}
      role="group"
      aria-label={t("Kuş bakışı ev planı")}
      data-floor-plan-canvas=""
      className={`block w-full select-none ${editing ? "touch-none" : ""} ${className}`}
    >
      <g aria-hidden="true" pointerEvents="none">
        <rect width={PLAN_WIDTH} height={PLAN_HEIGHT} fill={paper} />
        <path d={minorGrid} fill="none" stroke="var(--plan-grid)" strokeWidth={0.045} />
        <path d={metreGrid} fill="none" stroke="var(--plan-grid-major)" strokeWidth={0.075} />
      </g>
      {drawnRooms.map((room) => (
        <RoomDrawing
          key={room.id}
          room={room}
          roomName={room.roomId ? roomNames.get(room.roomId) : undefined}
          selected={room.id === selectedId}
          editing={editing}
        />
      ))}
      {[...walls, ...openings].map((shape) => (
        <SegmentDrawing key={shape.id} shape={shape} selected={shape.id === selectedId} allowHit={editing} />
      ))}
      {draft && (
        <g opacity={0.68} aria-hidden="true" pointerEvents="none">
          {draft.kind === "room"
            ? <RoomDrawing room={draft} roomName={undefined} selected editing />
            : <SegmentDrawing shape={draft} selected allowHit={false} />}
        </g>
      )}
    </svg>
  );
}
