import type { ArtObject, BrushType } from "./model";
export const BRUSHES: { id: BrushType; name: string }[] = [
  { id: "round", name: "ปากกากลม" },
  { id: "pencil", name: "ดินสอ" },
  { id: "marker", name: "มาร์กเกอร์" },
  { id: "highlighter", name: "ไฮไลต์" },
  { id: "airbrush", name: "แอร์บรัช" },
  { id: "flat", name: "พู่กันหัวแบน" },
];
const cache = new Map<string, HTMLCanvasElement>();
let pixels = 0;
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function path(c: CanvasRenderingContext2D, pts: number[], dx = 0, dy = 0) {
  c.beginPath();
  c.moveTo(pts[0] + dx, pts[1] + dy);
  for (let i = 2; i < pts.length; i += 2)
    c.lineTo(pts[i] + dx, pts[i + 1] + dy);
}
export function strokeCanvas(o: ArtObject, requestedScale: number) {
  const ratio = Math.min(
    Math.max(0.01, requestedScale),
    4096 / Math.max(o.width, o.height),
  );
  const key = JSON.stringify([
    o.width,
    o.height,
    o.points,
    o.fill,
    o.strokeWidth,
    o.brushType,
    o.seed,
    o.erasures,
    Math.round(ratio * 1000),
  ]);
  const old = cache.get(key);
  if (old) return old;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(o.width * ratio));
  c.height = Math.max(1, Math.ceil(o.height * ratio));
  const ctx = c.getContext("2d")!;
  ctx.scale(c.width / o.width, c.height / o.height);
  const w = o.strokeWidth || 1,
    pts = o.points || [0, 0, 0.01, 0.01],
    type = o.brushType || "round";
  ctx.strokeStyle = o.fill || "#000000";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  if (type === "round" || type === "marker" || type === "highlighter") {
    ctx.lineCap = type === "round" ? "round" : "square";
    ctx.globalAlpha = type === "highlighter" ? 0.35 : 1;
    path(ctx, pts);
    ctx.stroke();
  } else if (type === "pencil") {
    const random = rng(o.seed || 1);
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = w * 0.15;
    for (let k = 0; k < 8; k++) {
      const ox = (random() - 0.5) * w * 0.8,
        oy = (random() - 0.5) * w * 0.8;
      path(ctx, pts, ox, oy);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.14;
    for (let i = 2; i < pts.length; i += 2) {
      const dx = pts[i] - pts[i - 2],
        dy = pts[i + 1] - pts[i - 1],
        n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (w * 0.25)));
      for (let j = 0; j < n; j++) {
        ctx.beginPath();
        ctx.arc(
          pts[i - 2] + (dx * j) / n + (random() - 0.5) * w,
          pts[i - 1] + (dy * j) / n + (random() - 0.5) * w,
          w * 0.05,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  } else {
    for (let i = 2; i < pts.length; i += 2) {
      const dx = pts[i] - pts[i - 2],
        dy = pts[i + 1] - pts[i - 1],
        n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (w * 0.12)));
      for (let j = 0; j < n; j++) {
        const x = pts[i - 2] + (dx * j) / n,
          y = pts[i - 1] + (dy * j) / n;
        ctx.save();
        ctx.translate(x, y);
        if (type === "flat") {
          ctx.rotate(-Math.PI / 4);
          ctx.fillRect(-w * 0.5, -w * 0.13, w, w * 0.26);
        } else {
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.75);
          grad.addColorStop(0, (o.fill || "#000000") + "24");
          grad.addColorStop(1, (o.fill || "#000000") + "00");
          ctx.fillStyle = grad;
          ctx.fillRect(-w, -w, w * 2, w * 2);
        }
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  for (const e of o.erasures || []) {
    ctx.lineWidth = e.width;
    path(ctx, e.points);
    ctx.stroke();
  }
  while (
    cache.size &&
    (pixels + c.width * c.height > 24e6 || cache.size >= 60)
  ) {
    const key = cache.keys().next().value!;
    const old = cache.get(key)!;
    pixels -= old.width * old.height;
    cache.delete(key);
  }
  cache.set(key, c);
  pixels += c.width * c.height;
  return c;
}
export function clearBrushCache() {
  cache.clear();
  pixels = 0;
}
export function normalizeStroke(o: ArtObject): ArtObject {
  const pts = o.points!;
  const xs = pts.filter((_, i) => i % 2 === 0),
    ys = pts.filter((_, i) => i % 2 === 1);
  const pad = (o.strokeWidth || 1) * 1.25;
  const minX = Math.min(...xs) - pad,
    minY = Math.min(...ys) - pad;
  return {
    ...o,
    x:
      o.x +
      minX * Math.cos((o.rotation * Math.PI) / 180) -
      minY * Math.sin((o.rotation * Math.PI) / 180),
    y:
      o.y +
      minX * Math.sin((o.rotation * Math.PI) / 180) +
      minY * Math.cos((o.rotation * Math.PI) / 180),
    width: Math.max(0.01, Math.max(...xs) - minX + pad),
    height: Math.max(0.01, Math.max(...ys) - minY + pad),
    points: pts.map((n, i) => n - (i % 2 ? minY : minX)),
    erasures: o.erasures?.map((e) => ({
      ...e,
      points: e.points.map((n, i) => n - (i % 2 ? minY : minX)),
    })),
  };
}
export function toLocal(o: ArtObject, x: number, y: number) {
  const r = (-o.rotation * Math.PI) / 180,
    dx = x - o.x,
    dy = y - o.y;
  return {
    x: dx * Math.cos(r) - dy * Math.sin(r),
    y: dx * Math.sin(r) + dy * Math.cos(r),
  };
}
// Segment distance catches fast eraser movements even between pointer samples.
export function nearStroke(o: ArtObject, pts: number[], radius: number) {
  const p = o.points!,
    r = radius + (o.strokeWidth || 1),
    local: number[] = [];
  for (let j = 0; j < pts.length; j += 2) {
    const q = toLocal(o, pts[j], pts[j + 1]);
    local.push(q.x, q.y);
  }
  const distance = (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) => {
    const dx = bx - ax,
      dy = by - ay,
      t = Math.max(
        0,
        Math.min(
          1,
          ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  for (let j = 2; j < local.length; j += 2)
    for (let i = 2; i < p.length; i += 2) {
      const ax = p[i - 2],
        ay = p[i - 1],
        bx = p[i],
        by = p[i + 1],
        cx = local[j - 2],
        cy = local[j - 1],
        dx = local[j],
        dy = local[j + 1];
      if (
        Math.max(ax, bx) + r < Math.min(cx, dx) ||
        Math.min(ax, bx) - r > Math.max(cx, dx) ||
        Math.max(ay, by) + r < Math.min(cy, dy) ||
        Math.min(ay, by) - r > Math.max(cy, dy)
      )
        continue;
      const cross = (x: number, y: number, u: number, v: number) =>
          x * v - y * u,
        den = cross(bx - ax, by - ay, dx - cx, dy - cy);
      if (den) {
        const t = cross(cx - ax, cy - ay, dx - cx, dy - cy) / den,
          u = cross(cx - ax, cy - ay, bx - ax, by - ay) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
      }
      if (
        Math.min(
          distance(ax, ay, cx, cy, dx, dy),
          distance(bx, by, cx, cy, dx, dy),
          distance(cx, cy, ax, ay, bx, by),
          distance(dx, dy, ax, ay, bx, by),
        ) <= r
      )
        return true;
    }
  return false;
}
