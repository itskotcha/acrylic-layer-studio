import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Transformer, Rect, Line } from "react-konva";
import Konva from "konva";
import {
  Lock,
  Unlock,
  Copy,
  Trash2,
  RotateCw,
  Hand,
  Undo2,
} from "lucide-react";
import { useStudio, duplicateObject, deleteObject } from "../store";
import { usePreferences } from "../preferences";
import {
  baseObject,
  scaleObject,
  type ArtObject,
  type BrushType,
} from "../model";
import { normalizeStroke, toLocal, nearStroke } from "../brushes";
import ArtNode from "./ArtNode";
import RotationControl, { useRotationPreview } from "./RotationControl";
import { views2D } from "../viewState";
export type Tool = "select" | "pen" | "eraser" | "pan";
function bounds(o: ArtObject) {
  const r = (o.rotation * Math.PI) / 180;
  const pts = [
    [0, 0],
    [o.width, 0],
    [o.width, o.height],
    [0, o.height],
  ].map(([x, y]) => ({
    x: o.x + x * Math.cos(r) - y * Math.sin(r),
    y: o.y + x * Math.sin(r) + y * Math.cos(r),
  }));
  const x = Math.min(...pts.map((p) => p.x)),
    y = Math.min(...pts.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...pts.map((p) => p.x)) - x,
    height: Math.max(...pts.map((p) => p.y)) - y,
  };
}
export default function Editor({
  tool,
  color,
  brush,
  inkOpacity,
  brushType,
  eraseMode,
  onError,
}: {
  tool: Tool;
  color: string;
  brush: number;
  inkOpacity: number;
  brushType: BrushType;
  eraseMode: "stroke" | "partial";
  onError: (s: string) => void;
}) {
  const {
    project: p,
    assets,
    layerId,
    objectId,
    select,
    change,
    patchObject,
    undo,
    past,
  } = useStudio();
  const pref = usePreferences();
  const rotationPreview = useRotationPreview();
  const [rotationOpen, setRotationOpen] = useState(false);
  useEffect(() => setRotationOpen(false), [objectId, layerId, tool]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRotationOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const wrap = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    tr = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 600, h: 700 }),
    [view, setView] = useState(views2D.get(p.id) ?? { zoom: 1, px: 0, py: 0 }),
    [space, setSpace] = useState(false),
    [draft, setDraft] = useState<ArtObject | null>(null),
    [guides, setGuides] = useState<{ x?: number; y?: number }>({}),
    [menuTick, setMenuTick] = useState(0);
  const drawing = useRef<ArtObject | null>(null),
    erase = useRef<number[] | null>(null),
    pan = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    multi = useRef(false),
    pinch = useRef<{ distance: number; cx: number; cy: number } | null>(null);
  const [erasePreview, setErasePreview] = useState<number[]>([]);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        setSpace(e.type === "keydown");
      }
    };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const fit = Math.max(
      0.001,
      Math.min((size.w - 64) / p.width, (size.h - 110) / p.height),
    ),
    scale = fit * view.zoom,
    x = (size.w - p.width * scale) / 2 + view.px,
    y = (size.h - p.height * scale) / 2 + view.py;
  const stateRef = useRef({ scale, x, y, view, fit });
  stateRef.current = { scale, x, y, view, fit };
  const selectedLayer = p.layers.find((l) => l.id === layerId),
    selected = selectedLayer?.objects.find((o) => o.id === objectId);
  const locked = !!(selected?.locked || selectedLayer?.locked);
  const effectiveTool = space ? "pan" : tool;
  useEffect(() => {
    const node = objectId ? stage.current?.findOne("#" + objectId) : null;
    tr.current?.nodes(
      node &&
        effectiveTool === "select" &&
        !locked &&
        selectedLayer?.visible &&
        selected?.type !== "background"
        ? [node]
        : [],
    );
  }, [objectId, p, effectiveTool, locked, layerId, rotationPreview]);
  useEffect(() => {
    drawing.current = null;
    erase.current = null;
    setDraft(null);
    setErasePreview([]);
    setView(views2D.get(p.id) ?? { zoom: 1, px: 0, py: 0 });
  }, [p.id]);
  useEffect(() => {
    views2D.set(p.id, view);
  }, [view, p.id]);
  useEffect(() => {
    cancelDrawing();
  }, [tool, layerId]);
  const client = (e: PointerEvent | WheelEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const point = (e: PointerEvent) => {
    const pt = client(e);
    return { x: (pt.x - x) / scale, y: (pt.y - y) / scale };
  };
  function zoomAt(next: number, cx = size.w / 2, cy = size.h / 2) {
    const current = stateRef.current;
    const z = Math.max(0.25, Math.min(8, next)),
      ns = current.fit * z,
      ux = (cx - current.x) / current.scale,
      uy = (cy - current.y) / current.scale;
    setView({
      zoom: z,
      px: cx - ux * ns - (size.w - p.width * ns) / 2,
      py: cy - uy * ns - (size.h - p.height * ns) / 2,
    });
  }
  function cancelDrawing() {
    drawing.current = null;
    erase.current = null;
    pan.current = null;
    setDraft(null);
    setErasePreview([]);
    setGuides({});
  }
  function finish() {
    if (multi.current) {
      cancelDrawing();
      return;
    }
    const o = drawing.current,
      er = erase.current;
    cancelDrawing();
    if (o) {
      change((p) => {
        const l = p.layers.find((l) => l.id === layerId);
        if (
          l &&
          !l.locked &&
          l.visible &&
          p.layers.reduce((n, l) => n + l.objects.length, 0) < 500
        )
          l.objects.push(normalizeStroke(o));
      });
    }
    if (er) {
      const radius = (brush * Math.max(p.width, p.height)) / 1000;
      change((p) => {
        const l = p.layers.find((l) => l.id === layerId);
        if (!l || l.locked || !l.visible) return;
        l.objects = l.objects.filter((o) => {
          if (o.type !== "stroke" || o.locked || !nearStroke(o, er, radius / 2))
            return true;
          if (eraseMode === "stroke") return false;
          if ((o.erasures?.length || 0) >= 500) return true;
          const pts: number[] = [];
          for (let i = 0; i < er.length; i += 2) {
            const q = toLocal(o, er[i], er[i + 1]);
            pts.push(q.x, q.y);
          }
          o.erasures = [...(o.erasures || []), { points: pts, width: radius }];
          return true;
        });
      });
    }
  }
  const common = (o: ArtObject, lid: string, llocked: boolean) => ({
    id: o.id,
    draggable:
      effectiveTool === "select" &&
      !llocked &&
      !o.locked &&
      o.type !== "background",
    onClick: () => {
      if (effectiveTool === "select") select(lid, o.id);
    },
    onPointerClick: () => {
      if (effectiveTool === "select") select(lid, o.id);
    },
    onTap: () => {
      if (effectiveTool === "select") select(lid, o.id);
    },
    onDragStart: () => select(lid, o.id),
    onDragMove: (e: any) => {
      const n = e.target;
      if (!pref.snap) {
        setMenuTick((v) => v + 1);
        return;
      }
      const b = bounds({ ...o, x: n.x(), y: n.y() }),
        tx = [0, p.width / 2, p.width],
        ty = [0, p.height / 2, p.height];
      for (const l of p.layers)
        if (l.visible)
          for (const other of l.objects)
            if (other.id !== o.id && other.type !== "background") {
              const z = bounds(other);
              tx.push(z.x, z.x + z.width / 2, z.x + z.width);
              ty.push(z.y, z.y + z.height / 2, z.y + z.height);
            }
      const find = (own: number[], target: number[]) => {
        let best = 6 / scale;
        let delta = 0,
          guide: number | undefined;
        for (const a of own)
          for (const b of target)
            if (Math.abs(b - a) < best) {
              best = Math.abs(b - a);
              delta = b - a;
              guide = b;
            }
        return { delta, guide };
      };
      const sx = find([b.x, b.x + b.width / 2, b.x + b.width], tx),
        sy = find([b.y, b.y + b.height / 2, b.y + b.height], ty);
      n.position({ x: n.x() + sx.delta, y: n.y() + sy.delta });
      setGuides({ x: sx.guide, y: sy.guide });
      setMenuTick((v) => v + 1);
    },
    onDragEnd: (e: any) => {
      if (multi.current) {
        e.target.position({ x: o.x, y: o.y });
        return;
      }
      select(lid, o.id);
      patchObject({ x: e.target.x(), y: e.target.y() });
      setGuides({});
    },
    onTransform: () => setMenuTick((v) => v + 1),
    onTransformEnd: (e: any) => {
      const n = e.target;
      if (multi.current) {
        n.position({ x: o.x, y: o.y });
        n.scale({ x: 1, y: 1 });
        n.rotation(o.rotation);
        return;
      }
      const scaled = scaleObject(o, n.scaleX(), n.scaleY());
      n.scale({ x: 1, y: 1 });
      patchObject({ ...scaled, x: n.x(), y: n.y(), rotation: n.rotation() });
    },
  });
  let menu = { x: 12, y: 12 };
  const node = objectId ? stage.current?.findOne("#" + objectId) : null;
  if (node) {
    const b = node.getClientRect();
    menu = {
      x: Math.max(8, Math.min(size.w - 220, b.x + b.width / 2 - 106)),
      y: Math.max(
        8,
        Math.min(size.h - 100, b.y >= 66 ? b.y - 58 : b.y + b.height + 12),
      ),
    };
  }
  void menuTick;
  function captureDown(e: React.PointerEvent<HTMLDivElement>) {
    if (
      (e.target as HTMLElement).closest("button,select,input,.rotation-popover")
    )
      return;
    pointers.current.set(e.pointerId, client(e.nativeEvent));
    if (pointers.current.size === 2) {
      multi.current = true;
      cancelDrawing();
      stage.current?.find("Shape").forEach((n) => {
        if (n.isDragging()) n.stopDrag();
      });
      tr.current?.stopTransform();
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function captureMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, client(e.nativeEvent));
    if (multi.current) {
      e.preventDefault();
      e.stopPropagation();
      const pts = [...pointers.current.values()];
      if (pts.length === 2) {
        const [a, b] = pts,
          next = {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            cx: (a.x + b.x) / 2,
            cy: (a.y + b.y) / 2,
          },
          prev = pinch.current;
        if (prev) {
          const st = stateRef.current,
            z = Math.max(
              0.25,
              Math.min(
                8,
                (st.view.zoom * next.distance) / (prev.distance || 1),
              ),
            ),
            ns = st.fit * z,
            ux = (prev.cx - st.x) / st.scale,
            uy = (prev.cy - st.y) / st.scale;
          setView({
            zoom: z,
            px: next.cx - ux * ns - (size.w - p.width * ns) / 2,
            py: next.cy - uy * ns - (size.h - p.height * ns) / 2,
          });
        }
        pinch.current = next;
      }
    }
  }
  function captureUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (multi.current) {
      e.stopPropagation();
      if (!pointers.current.size) {
        multi.current = false;
        pinch.current = null;
      }
      return;
    }
  }
  return (
    <div
      className={"editor-wrap " + effectiveTool + " desk-" + pref.desk}
      ref={wrap}
      data-testid="editor"
      onPointerDownCapture={captureDown}
      onPointerMoveCapture={captureMove}
      onPointerUpCapture={captureUp}
      onPointerCancelCapture={(e) => {
        captureUp(e);
        cancelDrawing();
      }}
    >
      <div
        className={"artboard desk-" + pref.desk}
        style={{
          left: x,
          top: y,
          width: p.width * scale,
          height: p.height * scale,
        }}
      />
      <Stage
        ref={stage}
        width={size.w}
        height={size.h}
        onWheel={(e) => {
          e.evt.preventDefault();
          const pt = client(e.evt);
          zoomAt(view.zoom * Math.exp(-e.evt.deltaY * 0.002), pt.x, pt.y);
        }}
        onPointerDown={(e) => {
          if (multi.current) return;
          const ev = e.evt as PointerEvent;
          try {
            (ev.target as Element).setPointerCapture(ev.pointerId);
          } catch {}
          const pt = point(ev);
          if (effectiveTool === "pan") {
            const c = client(ev);
            pan.current = { x: c.x, y: c.y, px: view.px, py: view.py };
            return;
          }
          if (effectiveTool === "select") {
            if (e.target === e.target.getStage() || e.target.name() === "paper")
              select(layerId);
            return;
          }
          if (
            !selectedLayer ||
            selectedLayer.locked ||
            !selectedLayer.visible
          ) {
            onError("เลือกชั้นที่ไม่ล็อกและเปิดแสดงก่อนวาด");
            return;
          }
          if (pt.x < 0 || pt.y < 0 || pt.x > p.width || pt.y > p.height) return;
          if (tool === "eraser") {
            erase.current = [pt.x, pt.y, pt.x + 0.001, pt.y + 0.001];
            setErasePreview(erase.current);
            return;
          }
          drawing.current = {
            ...baseObject("stroke"),
            width: p.width,
            height: p.height,
            points: [pt.x, pt.y, pt.x + 0.001, pt.y + 0.001],
            fill: color,
            strokeWidth: (brush * Math.max(p.width, p.height)) / 1000,
            opacity: inkOpacity,
            brushType,
            brushVersion: 1,
            seed: Math.floor(Math.random() * 1e9),
            erasures: [],
          };
          setDraft({ ...drawing.current });
        }}
        onPointerMove={(e) => {
          if (multi.current) return;
          const ev = e.evt as PointerEvent;
          if (pan.current) {
            const pt = client(ev);
            setView((v) => ({
              ...v,
              px: pan.current!.px + pt.x - pan.current!.x,
              py: pan.current!.py + pt.y - pan.current!.y,
            }));
            return;
          }
          const pt = point(ev);
          if (erase.current && erase.current.length < 40000) {
            erase.current.push(pt.x, pt.y);
            setErasePreview([...erase.current]);
          }
          if (drawing.current && drawing.current.points!.length < 40000) {
            drawing.current.points!.push(pt.x, pt.y);
            setDraft({
              ...drawing.current,
              points: [...drawing.current.points!],
            });
          }
        }}
        onPointerUp={finish}
        onPointerCancel={cancelDrawing}
      >
        <Layer>
          <Rect
            name="paper"
            x={x}
            y={y}
            width={p.width * scale}
            height={p.height * scale}
            fill="rgba(0,0,0,0)"
          />
          <Group
            x={x}
            y={y}
            scaleX={scale}
            scaleY={scale}
            clipX={0}
            clipY={0}
            clipWidth={p.width}
            clipHeight={p.height}
          >
            {p.layers
              .filter((l) => l.visible)
              .map((l) => (
                <Group key={l.id}>
                  {l.objects.map((o) => (
                    <ArtNode
                      key={o.id}
                      o={
                        rotationPreview.source === p &&
                        rotationPreview.object?.id === o.id
                          ? rotationPreview.object
                          : o
                      }
                      assets={assets}
                      scale={scale * Math.min(devicePixelRatio, 2)}
                      {...common(o, l.id, l.locked)}
                    />
                  ))}
                  {draft && l.id === layerId && (
                    <ArtNode
                      o={normalizeStroke(draft)}
                      assets={{}}
                      scale={scale * Math.min(devicePixelRatio, 2)}
                      listening={false}
                    />
                  )}
                </Group>
              ))}
            {erasePreview.length > 0 && (
              <Line
                points={erasePreview}
                stroke="#f28fa6"
                opacity={0.5}
                strokeWidth={(brush * Math.max(p.width, p.height)) / 1000}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}
            {guides.x !== undefined && (
              <Line
                points={[guides.x, 0, guides.x, p.height]}
                stroke="#a89bff"
                strokeWidth={1 / scale}
                listening={false}
              />
            )}
            {guides.y !== undefined && (
              <Line
                points={[0, guides.y, p.width, guides.y]}
                stroke="#a89bff"
                strokeWidth={1 / scale}
                listening={false}
              />
            )}
          </Group>
          <Transformer
            ref={tr}
            keepRatio
            flipEnabled={false}
            rotateEnabled
            borderStroke="#8273ee"
            anchorStroke="#8273ee"
            anchorSize={10}
            rotateAnchorOffset={28}
            boundBoxFunc={(a, b) =>
              Math.abs(b.width) < 3 || Math.abs(b.height) < 3 ? a : b
            }
          />
        </Layer>
      </Stage>
      {selected &&
        selected.type !== "background" &&
        selectedLayer?.visible &&
        effectiveTool === "select" && (
          <div
            className="object-toolbar"
            data-testid="object-toolbar"
            style={{ left: menu.x, top: menu.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              aria-label={selected.locked ? "ปลดล็อกวัตถุ" : "ล็อกวัตถุ"}
              disabled={selectedLayer.locked}
              onClick={() => patchObject({ locked: !selected.locked })}
            >
              {selected.locked ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
            <button
              aria-label="ทำสำเนาวัตถุ"
              disabled={selectedLayer.locked}
              onClick={duplicateObject}
            >
              <Copy size={18} />
            </button>
            <button
              aria-label="ลบวัตถุที่เลือก"
              disabled={locked}
              onClick={() => {
                deleteObject();
                onError("ลบวัตถุแล้ว · กด Undo เพื่อคืนกลับ");
              }}
            >
              <Trash2 size={18} />
            </button>
            <button
              aria-label="หมุนวัตถุ"
              aria-expanded={rotationOpen}
              disabled={locked}
              onClick={() => setRotationOpen(!rotationOpen)}
            >
              <RotateCw size={20} />
            </button>
          </div>
        )}
      {rotationOpen && (
        <div
          className="rotation-popover"
          role="dialog"
          aria-label="หมุนวัตถุ 360 องศา"
        >
          <div className="panel-heading">
            หมุนวัตถุ
            <button
              aria-label="ปิดการหมุน"
              onClick={() => setRotationOpen(false)}
            >
              ✕
            </button>
          </div>
          <RotationControl />
        </div>
      )}
      <div className="canvas-meta">
        {Number(p.width.toFixed(2))} × {Number(p.height.toFixed(2))} หน่วย ·{" "}
        {p.layers.length} ชั้น
      </div>
      <div className="zoom">
        <button
          aria-label="ย้อนกลับบนผืนงาน"
          disabled={!past.length}
          onClick={undo}
        >
          <Undo2 size={15} />
        </button>
        <button aria-label="ซูมออก" onClick={() => zoomAt(view.zoom / 1.2)}>
          −
        </button>
        <button
          title="พอดีหน้าจอ"
          onClick={() => setView({ zoom: 1, px: 0, py: 0 })}
        >
          พอดีหน้าจอ
        </button>
        <span className="zoom-value" aria-label="ระดับซูม">
          {Math.round(view.zoom * 100)}%
        </span>
        <button aria-label="ซูมเข้า" onClick={() => zoomAt(view.zoom * 1.2)}>
          +
        </button>
      </div>
      {effectiveTool === "pan" && (
        <div className="pan-label">
          <Hand size={14} />
          ลากเพื่อเลื่อนผืนงาน
        </div>
      )}
    </div>
  );
}
