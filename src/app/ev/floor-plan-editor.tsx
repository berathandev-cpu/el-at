"use client";

import { useTranslations } from "@/lib/i18n-client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type Ref } from "react";

import {
  PLAN_HEIGHT,
  PLAN_MAX_LABEL_LENGTH,
  PLAN_MAX_SHAPES,
  PLAN_WIDTH,
  type FloorPlanKind,
  type FloorPlanShape,
} from "@/lib/floor-plan-schema";
import { FloorPlanCanvas } from "./floor-plan-canvas";
import { drawShape, GRID_PER_METER, moveShape, planRoomLabel, snapPoint, TOOL_LABELS, type Point } from "./floor-plan-editor-geometry";
import { saveFloorPlan } from "./plan-actions";
import styles from "./floor-plan.module.css";

type RoomOption = { id: string; name: string };
type Tool = "select" | FloorPlanKind;
type Drag = {
  pointerId: number;
  start: Point;
} & ({ tool: "select"; shape: FloorPlanShape } | { tool: FloorPlanKind; id: string });

const tools = [
  { id: "select", label: "Seç", path: "m5 4 14 7-7 1.5L9 19 5 4Z" },
  { id: "room", label: TOOL_LABELS.room, path: "M5 5h14v14H5z" },
  { id: "wall", label: TOOL_LABELS.wall, path: "M4 12h16M4 9v6m16-6v6" },
  { id: "door", label: TOOL_LABELS.door, path: "M5 19V5m0 14h14A14 14 0 0 0 5 5" },
  { id: "window", label: TOOL_LABELS.window, path: "M4 8h16v8H4zM4 12h16" },
] satisfies { id: Tool; label: string; path: string }[];

const button = "min-h-11 rounded-sm border border-line px-3 py-2 text-sm font-bold text-board hover:bg-paper-raised disabled:opacity-45";
const primary = "primary-action text-sm disabled:opacity-50";
const field = "mt-1 min-h-11 min-w-0 w-full rounded-sm border border-line bg-paper-raised px-2 py-2 text-sm text-ink";

function shapeId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, "0")).join("");
}

function pointAt(event: PointerEvent<SVGSVGElement>): Point | null {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const { x, y } = point.matrixTransform(matrix.inverse());
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return snapPoint({ x, y });
}

function shapeDuringDrag(drag: Drag, point: Point) {
  return drag.tool === "select"
    ? moveShape(drag.shape, drag.start, point)
    : drawShape(drag.tool, drag.id, drag.start, point);
}

function readInspector(shape: FloorPlanShape, element: HTMLFormElement, rooms: RoomOption[], defaultRoomLabel: string): { shape: FloorPlanShape } | { error: string } {
  if (!element.reportValidity()) return { error: "Şeklin ölçülerini ve adını kontrol et." };
  const form = new FormData(element);
  const value = (key: string) => Number(form.get(key)) * GRID_PER_METER;
  if (shape.kind === "room") {
    const x = value("x");
    const y = value("y");
    const width = value("width");
    const height = value("height");
    const roomId = String(form.get("roomId")) || null;
    const enteredLabel = String(form.get("label")).trim();
    const linkedName = rooms.find((room) => room.id === roomId)?.name.trim().slice(0, PLAN_MAX_LABEL_LENGTH);
    const label = (shape.label === TOOL_LABELS.room && !shape.roomId && enteredLabel === defaultRoomLabel) || enteredLabel === TOOL_LABELS.room
      ? linkedName ?? TOOL_LABELS.room
      : enteredLabel;
    if (!label) return { error: "Oda için bir ad yaz." };
    if (x + width > PLAN_WIDTH || y + height > PLAN_HEIGHT) {
      return { error: "Oda, çizim alanının dışına çıkıyor." };
    }
    return { shape: { ...shape, x, y, width, height, label, roomId } };
  }

  const x1 = value("x1");
  const y1 = value("y1");
  const x2 = value("x2");
  const y2 = value("y2");
  if ((x1 !== x2 && y1 !== y2) || (x1 === x2 && y1 === y2)) {
    return { error: "İki farklı uç seç. Çizgi yatay veya dikey olmalı." };
  }
  return { shape: { ...shape, x1, y1, x2, y2 } };
}

function MeterField({ name, label, units, maxUnits, minUnits = 0 }: {
  name: string;
  label: string;
  units: number;
  maxUnits: number;
  minUnits?: number;
}) {
  const { t } = useTranslations();
  return (
    <label className="min-w-0 text-sm font-semibold">
      {t("{label} (m)", { label: t(label) })}
      <input
        className={field}
        name={name}
        type="number"
        min={minUnits / GRID_PER_METER}
        max={maxUnits / GRID_PER_METER}
        step={1 / GRID_PER_METER}
        inputMode="decimal"
        required
        defaultValue={units / GRID_PER_METER}
      />
    </label>
  );
}

function ShapeInspector({ shape, rooms, disabled, formRef, onChange, onInput, onReset, onRemove }: {
  shape: FloorPlanShape;
  rooms: RoomOption[];
  disabled: boolean;
  formRef: Ref<HTMLFormElement>;
  onChange: (value: FloorPlanShape) => void;
  onInput: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslations();
  const [error, setError] = useState("");

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readInspector(shape, event.currentTarget, rooms, t(TOOL_LABELS.room));
    if ("error" in result) return setError(result.error);
    onChange(result.shape);
    setError("");
  }

  return (
    <form
      ref={formRef}
      onSubmit={apply}
      onChange={onInput}
      onReset={() => { setError(""); onReset(); }}
      className="min-w-0 rounded-sm border border-line bg-paper-raised/40 px-4 py-3"
    >
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <legend className="mb-1 text-sm font-extrabold">{t("{shape} özellikleri", { shape: t(TOOL_LABELS[shape.kind]) })}</legend>
        {shape.kind === "room" ? (
          <>
            <div className="grid gap-3 min-[450px]:grid-cols-2">
              <label className="min-w-0 text-sm font-semibold">
                {t("Plan üzerindeki ad")}
                <input className={field} name="label" defaultValue={planRoomLabel(shape, t(TOOL_LABELS.room))} maxLength={PLAN_MAX_LABEL_LENGTH} required />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                {t("Görevlerle bağlantı")}
                <select className={field} name="roomId" defaultValue={shape.roomId ?? ""}>
                  <option value="">{t("Bağlantı yok")}</option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MeterField name="x" label="Soldan" units={shape.x} maxUnits={PLAN_WIDTH - 2} />
              <MeterField name="y" label="Üstten" units={shape.y} maxUnits={PLAN_HEIGHT - 2} />
              <MeterField name="width" label="Genişlik" units={shape.width} minUnits={2} maxUnits={PLAN_WIDTH} />
              <MeterField name="height" label="Derinlik" units={shape.height} minUnits={2} maxUnits={PLAN_HEIGHT} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MeterField name="x1" label="Başlangıç X" units={shape.x1} maxUnits={PLAN_WIDTH} />
            <MeterField name="y1" label="Başlangıç Y" units={shape.y1} maxUnits={PLAN_HEIGHT} />
            <MeterField name="x2" label="Bitiş X" units={shape.x2} maxUnits={PLAN_WIDTH} />
            <MeterField name="y2" label="Bitiş Y" units={shape.y2} maxUnits={PLAN_HEIGHT} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={button}>{t("Özellikleri uygula")}</button>
          <button type="reset" className={button}>{t("Alanları sıfırla")}</button>
          <button type="button" onClick={onRemove} className="min-h-11 rounded-sm px-3 text-sm font-bold text-danger hover:bg-danger/10">{t("Şekli sil")}</button>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{t(error)}</p>}
      </fieldset>
    </form>
  );
}

export function FloorPlanEditor({ familyId, initialShapes, initialRevision, rooms }: {
  familyId: string;
  initialShapes: FloorPlanShape[];
  initialRevision: number;
  rooms: RoomOption[];
}) {
  const { t, locale } = useTranslations();
  const [saved, setSaved] = useState({ shapes: initialShapes, revision: initialRevision });
  const [shapes, setShapes] = useState(initialShapes);
  const [history, setHistory] = useState<FloorPlanShape[][]>([]);
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState<Tool>("room");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FloorPlanShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [inspectorDirty, setInspectorDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  const numbers = new Intl.NumberFormat(locale);
  const drag = useRef<Drag | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const inspectorRef = useRef<HTMLFormElement>(null);
  const skipUnloadWarning = useRef(false);
  const selected = shapes.find((shape) => shape.id === selectedId);
  const dirty = shapes !== saved.shapes || inspectorDirty;

  useEffect(() => {
    if (!dirty || !editing) return;
    function warn(event: BeforeUnloadEvent) {
      if (skipUnloadWarning.current) return;
      event.preventDefault();
      event.returnValue = true;
    }
    function guardNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
          !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const target = new URL(link.href);
      if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      if (!window.confirm(t("Ev planındaki değişiklikler kaydedilmedi. Yine de bu sayfadan ayrılsın mı?"))) {
        event.preventDefault();
      } else {
        skipUnloadWarning.current = true;
      }
    }
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [dirty, editing, t]);

  function commit(next: FloorPlanShape[]) {
    setHistory((previous) => [...previous.slice(-24), shapes]);
    setShapes(next);
    setInspectorDirty(false);
    setConfirmExit(false);
    setFeedback({});
  }

  function append(shape: FloorPlanShape) {
    commit([...shapes, shape]);
    setSelectedId(shape.id);
  }

  function update(shape: FloorPlanShape) {
    const previous = shapes.find((item) => item.id === shape.id);
    if (JSON.stringify(previous) !== JSON.stringify(shape)) {
      commit(shapes.map((item) => item.id === shape.id ? shape : item));
    }
    setInspectorDirty(false);
    setFeedback({ message: "Özellikler taslağa uygulandı." });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setShapes(previous);
    setHistory(history.slice(0, -1));
    setSelectedId(null);
    setConfirmExit(false);
    setFeedback({ message: "Son işlem geri alındı." });
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !event.isPrimary || saving || drag.current) return;
    if (inspectorDirty) {
      setFeedback({ error: "Çizime dönmeden önce özellikleri uygula veya alanları sıfırla." });
      return;
    }
    const point = pointAt(event);
    if (!point) return;
    if (tool === "select") {
      const id = event.target instanceof Element
        ? event.target.closest("[data-shape-id]")?.getAttribute("data-shape-id")
        : null;
      const shape = shapes.find((item) => item.id === id);
      setSelectedId(shape?.id ?? null);
      if (!shape) return;
      drag.current = { pointerId: event.pointerId, tool, shape, start: point };
    } else {
      if (shapes.length >= PLAN_MAX_SHAPES) {
        setFeedback({ error: "Plan en çok {limit} öğe içerebilir." });
        return;
      }
      drag.current = { pointerId: event.pointerId, tool, id: shapeId(), start: point };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (active?.pointerId !== event.pointerId) return;
    const point = pointAt(event);
    if (point) setDraft(shapeDuringDrag(active, point));
  }

  function cancelDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDraft(null);
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (active?.pointerId !== event.pointerId) return;
    cancelDrag(event);
    const point = pointAt(event);
    if (!point) return;
    const next = shapeDuringDrag(active, point);
    if (!next) {
      setFeedback({ error: active.tool === "room" ? "Oda için en az 2 × 2 kare çiz." : "Çizgi için en az bir kare sürükle." });
    } else if (active.tool === "select") {
      if (next !== active.shape) commit(shapes.map((shape) => shape.id === next.id ? next : shape));
    } else {
      append(next);
    }
  }

  function addDefault() {
    if (tool === "select" || shapes.length >= PLAN_MAX_SHAPES) return;
    const offset = 4 + (shapes.length % 10) * 2;
    const start = { x: offset, y: offset };
    const end = {
      x: offset + (tool === "room" ? 12 : tool === "wall" ? 8 : 4),
      y: offset + (tool === "room" ? 8 : 0),
    };
    const shape = drawShape(tool, shapeId(), start, end);
    if (shape) append(shape);
  }

  async function save() {
    if (!dirty || conflict || saving || drag.current) return;
    let next = shapes;
    if (inspectorDirty && selected && inspectorRef.current) {
      const result = readInspector(selected, inspectorRef.current, rooms, t(TOOL_LABELS.room));
      if ("error" in result) {
        setFeedback({ error: result.error });
        return;
      }
      if (JSON.stringify(result.shape) !== JSON.stringify(selected)) {
        next = shapes.map((shape) => shape.id === selected.id ? result.shape : shape);
      }
    }
    if (next === saved.shapes) {
      setInspectorDirty(false);
      setFeedback({});
      return;
    }
    setSaving(true);
    setFeedback({});
    try {
      const result = await saveFloorPlan({ familyId, revision: saved.revision, shapes: next });
      if (result.ok) {
        setSaved({ shapes: next, revision: result.revision });
        setShapes(next);
        setInspectorDirty(false);
        setHistory([]);
        setConfirmExit(false);
        setFeedback({ message: "Ev planı kaydedildi." });
      } else {
        setConflict(Boolean(result.conflict));
        setFeedback({ error: result.error });
      }
    } catch {
      setFeedback({ error: "Plan kaydedilemedi. Bağlantını kontrol edip tekrar dene." });
    } finally {
      setSaving(false);
    }
  }

  function exitEditor() {
    setShapes(saved.shapes);
    setHistory([]);
    setInspectorDirty(false);
    setEditing(false);
    setSelectedId(null);
    setConfirmExit(false);
    setFeedback({});
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {saved.shapes.length > 0 ? (
          <div className={styles.canvasFrame}>
            <FloorPlanCanvas shapes={saved.shapes} rooms={rooms} />
          </div>
        ) : (
          <p className={styles.blankPlan}>{t("Henüz bir ev planı çizilmedi.")}</p>
        )}
        <div className={`glass-control ${styles.viewerActions}`}>
          <button type="button" className={primary} onClick={() => setEditing(true)}>
            {t("Planı düzenle")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 text-ink">
      <div className={`glass-control ${styles.editorToolbar}`}>
        <div className={styles.toolPicker} role="group" aria-label={t("Çizim araçları")}>
          {tools.map(({ id, label, path }) => (
            <button
              key={id} type="button" aria-pressed={id === tool} disabled={saving}
              className={styles.toolButton}
              onClick={() => setTool(id)}
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                <path d={path} />
              </svg>
              {t(label)}
            </button>
          ))}
        </div>
        <div className={styles.documentActions} role="group" aria-label={t("Plan işlemleri")}>
          <button type="button" className={primary} disabled={!dirty || saving || conflict} onClick={save}>
            {t(saving ? "Kaydediliyor…" : "Planı kaydet")}
          </button>
          <button type="button" className={styles.quietAction} disabled={!history.length || saving || inspectorDirty} onClick={undo}>{t("Geri al")}</button>
          <button type="button" className={styles.quietAction} disabled={saving} onClick={() => dirty || conflict ? setConfirmExit(true) : exitEditor()}>
            {t("Düzenlemeyi bitir")}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {feedback.error && <p role="alert" className="text-sm font-semibold text-danger">{t(feedback.error, { limit: numbers.format(PLAN_MAX_SHAPES) })}</p>}
        <p role="status" className={styles.editorStatus} data-dirty={dirty}>
          {t(saving ? "Plan kaydediliyor…" : feedback.message ?? (dirty ? "Kaydedilmemiş değişiklikler var." : "Tüm değişiklikler kaydedildi."))}
        </p>
        {confirmExit && (
          <div className="rounded-sm border border-danger/30 p-3">
            <p className="text-sm font-semibold">
              {t(conflict ? "Güncel planı yüklemek bu cihazdaki taslağı kaldırır." : "Bu taslağı kaydetmeden kapatmak istiyor musun?")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => setConfirmExit(false)}>{t("Düzenlemeye dön")}</button>
              <button type="button" className={button} onClick={() => {
                if (conflict) {
                  skipUnloadWarning.current = true;
                  window.location.reload();
                } else {
                  exitEditor();
                }
              }}>{t(conflict ? "Taslağı bırak ve güncel planı aç" : "Taslağı bırak")}</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-medium text-ink-muted">
        <p>{t(tool === "select" ? "Bir öğeyi seç veya sürükleyerek taşı." : "Başlangıçtan bitişe sürükle.")} {t("Her kare 25 cm.")}</p>
        <span className="tabular-nums">{t("{count} / {limit} öğe", { count: numbers.format(shapes.length), limit: numbers.format(PLAN_MAX_SHAPES) })}</span>
      </div>
      <div className={styles.canvasFrame}>
        <FloorPlanCanvas
          shapes={shapes}
          rooms={rooms}
          canvasRef={canvasRef}
          editing
          selectedId={selectedId}
          draft={draft}
          className={tool === "select" ? "cursor-move" : "cursor-crosshair"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0 text-sm font-semibold">
          {t("Plandan bir şekil seç")}
          <select className={field} value={selected?.id ?? ""} disabled={saving || inspectorDirty} onChange={(event) => setSelectedId(event.target.value || null)}>
            <option value="">{t("Şekil seçilmedi")}</option>
            {shapes.map((shape, index) => (
              <option key={shape.id} value={shape.id}>
                {numbers.format(index + 1)}. {shape.kind === "room" ? planRoomLabel(shape, t(TOOL_LABELS.room)) : t(TOOL_LABELS[shape.kind])}
              </option>
            ))}
          </select>
        </label>
        {tool !== "select" && (
          <button disabled={saving || inspectorDirty || shapes.length >= PLAN_MAX_SHAPES} type="button" className={button} onClick={addDefault}>
            {t("Varsayılan ölçüyle {shape} ekle", { shape: t(TOOL_LABELS[tool]).toLocaleLowerCase(locale) })}
          </button>
        )}
      </div>
      {selected && (
        <ShapeInspector
          key={JSON.stringify(selected)}
          shape={selected}
          rooms={rooms}
          disabled={saving}
          formRef={inspectorRef}
          onChange={update}
          onInput={() => setInspectorDirty(true)}
          onReset={() => { setInspectorDirty(false); setFeedback({}); }}
          onRemove={() => {
            commit(shapes.filter((shape) => shape.id !== selected.id));
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
