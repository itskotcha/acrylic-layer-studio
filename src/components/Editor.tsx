import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Group,
  Image as KImage,
  Text,
  Line,
  Transformer,
  Rect,
} from "react-konva";
import Konva from "konva";
import { useStudio } from "../store";
import { baseObject, type ArtObject, type Asset } from "../model";
import { loadImage } from "../io";
export type Tool = "select" | "pen" | "eraser";
function ImageNode({
  asset,
  ...props
}: { asset: Asset } & Record<string, any>) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    let active = true;
    loadImage(asset.data).then((im) => {
      if (active) setImage(im);
    });
    return () => {
      active = false;
    };
  }, [asset.data]);
  return <KImage {...props} image={image} />;
}
export default function Editor({
  tool,
  color,
  brush,
  inkOpacity,
}: {
  tool: Tool;
  color: string;
  brush: number;
  inkOpacity: number;
}) {
  const {
    project: p,
    assets,
    layerId,
    objectId,
    select,
    change,
    patchObject,
  } = useStudio();
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const tr = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 600, h: 700 });
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<ArtObject | null>(null);
  const drawing = useRef<ArtObject | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const fit = Math.min((size.w - 80) / p.width, (size.h - 90) / p.height);
  const scale = Math.max(0.03, fit) * zoom;
  const x = (size.w - p.width * scale) / 2,
    y = (size.h - p.height * scale) / 2;
  useEffect(() => {
    const node = objectId ? stage.current?.findOne("#" + objectId) : null;
    const l = p.layers.find((l) => l.id === layerId);
    tr.current?.nodes(
      node && tool === "select" && !l?.locked && l?.visible ? [node] : [],
    );
  }, [objectId, p, tool, layerId]);
  const point = () => {
    const pt = stage.current?.getPointerPosition();
    return pt ? { x: (pt.x - x) / scale, y: (pt.y - y) / scale } : null;
  };
  function finish() {
    const o = drawing.current;
    if (!o) return;
    drawing.current = null;
    setDraft(null);
    change((p) => {
      const l = p.layers.find((l) => l.id === layerId);
      if (
        l &&
        !l.locked &&
        l.visible &&
        p.layers.reduce((n, l) => n + l.objects.length, 0) < 500
      )
        l.objects.push(o);
    });
  }
  function eraseAt() {
    const pt = point();
    if (!pt) return;
    change((p) => {
      const l = p.layers.find((l) => l.id === layerId);
      if (!l || l.locked) return;
      l.objects = l.objects.filter((o) => {
        if (o.type !== "stroke") return true;
        const node = stage.current?.findOne("#" + o.id);
        if (!node) return true;
        const local = node
          .getAbsoluteTransform()
          .copy()
          .invert()
          .point(stage.current!.getPointerPosition()!);
        const pts = o.points!;
        const radius = brush + o.strokeWidth! / 2;
        for (let i = 2; i < pts.length; i += 2) {
          const ax = pts[i - 2],
            ay = pts[i - 1],
            bx = pts[i],
            by = pts[i + 1],
            dx = bx - ax,
            dy = by - ay;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((local.x - ax) * dx + (local.y - ay) * dy) /
                (dx * dx + dy * dy || 1),
            ),
          );
          if (Math.hypot(local.x - ax - t * dx, local.y - ay - t * dy) < radius)
            return false;
        }
        return true;
      });
    });
  }
  const common = (o: ArtObject, lid: string, locked: boolean) => ({
    ...o,
    id: o.id,
    draggable: tool === "select" && !locked,
    onClick: () => {
      if (tool === "select") select(lid, o.id);
    },
    onTap: () => {
      if (tool === "select") select(lid, o.id);
    },
    onDragStart: () => select(lid, o.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      select(lid, o.id);
      patchObject({ x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      const sx = n.scaleX(),
        sy = n.scaleY();
      n.scaleX(1);
      n.scaleY(1);
      const patch: Partial<ArtObject> = {
        x: n.x(),
        y: n.y(),
        rotation: n.rotation(),
        width: Math.max(4, o.width * sx),
        height: Math.max(4, o.height * sy),
      };
      if (o.type === "stroke")
        patch.points = o.points!.map((v, i) => v * (i % 2 ? sy : sx));
      if (o.type === "text") patch.fontSize = Math.max(1, o.fontSize! * sy);
      patchObject(patch);
    },
  });
  return (
    <div className={"editor-wrap " + tool} ref={wrap} data-testid="editor">
      <Stage
        ref={stage}
        width={size.w}
        height={size.h}
        onPointerDown={(e) => {
          const l = p.layers.find((l) => l.id === layerId);
          if (tool === "select") {
            if (e.target === e.target.getStage() || e.target.name() === "paper")
              select(layerId);
            return;
          }
          if (!l || l.locked || !l.visible) return;
          if (tool === "eraser") {
            eraseAt();
            return;
          }
          const pt = point();
          if (!pt || pt.x < 0 || pt.y < 0 || pt.x > p.width || pt.y > p.height)
            return;
          drawing.current = {
            ...baseObject("stroke"),
            x: 0,
            y: 0,
            width: p.width,
            height: p.height,
            points: [pt.x, pt.y, pt.x + 0.01, pt.y + 0.01],
            fill: color,
            strokeWidth: brush,
            opacity: inkOpacity,
          };
          setDraft({ ...drawing.current });
          const ev = e.evt as PointerEvent;
          if (ev.pointerId !== undefined)
            try {
              (ev.target as Element).setPointerCapture(ev.pointerId);
            } catch {}
        }}
        onPointerMove={() => {
          const pt = point();
          if (!drawing.current || !pt) return;
          if (drawing.current.points!.length >= 40000) return;
          drawing.current.points!.push(pt.x, pt.y);
          setDraft({
            ...drawing.current,
            points: [...drawing.current.points!],
          });
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <Layer>
          <Rect
            name="paper"
            x={x}
            y={y}
            width={p.width * scale}
            height={p.height * scale}
            fill="#fff"
            shadowBlur={25}
            shadowColor="#233c48"
            shadowOpacity={0.15}
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
                  {l.objects.map((o) =>
                    o.type === "image" ? (
                      <ImageNode
                        key={o.id}
                        asset={assets[o.assetId!]}
                        {...common(o, l.id, l.locked)}
                      />
                    ) : o.type === "text" ? (
                      <Text
                        key={o.id}
                        {...common(o, l.id, l.locked)}
                        lineHeight={1.3}
                      />
                    ) : (
                      <Line
                        key={o.id}
                        {...common(o, l.id, l.locked)}
                        stroke={o.fill}
                        lineCap="round"
                        lineJoin="round"
                        fillEnabled={false}
                      />
                    ),
                  )}
                  {draft && l.id === layerId && (
                    <Line
                      {...draft}
                      stroke={draft.fill}
                      lineCap="round"
                      lineJoin="round"
                      fillEnabled={false}
                      listening={false}
                    />
                  )}
                </Group>
              ))}
          </Group>
          <Transformer
            ref={tr}
            keepRatio
            flipEnabled={false}
            rotateEnabled
            borderStroke="#267d83"
            anchorStroke="#267d83"
            anchorSize={9}
            boundBoxFunc={(old, b) =>
              Math.abs(b.width) < 5 || Math.abs(b.height) < 5 ? old : b
            }
          />
        </Layer>
      </Stage>
      <div className="canvas-meta">
        {p.width} × {p.height} px <span>·</span> {p.layers.length} ชั้น
      </div>
      <div className="zoom">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          aria-label="ซูมออก"
        >
          −
        </button>
        <button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          aria-label="ซูมเข้า"
        >
          +
        </button>
      </div>
    </div>
  );
}
