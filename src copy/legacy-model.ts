export type ArtObject = {
  id: string;
  type: "image" | "text" | "stroke";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  assetId?: string;
  text?: string;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  align?: "left" | "center" | "right";
  points?: number[];
  strokeWidth?: number;
};
export type DepthLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  depth: number;
  objects: ArtObject[];
};
export type Project = {
  schemaVersion: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  thickness: number;
  layers: DepthLayer[];
};
export type Asset = {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  data: string;
};
export type Assets = Record<string, Asset>;
export const uid = () => crypto.randomUUID();
export const clone = <T>(v: T): T => structuredClone(v);
export const MAX_SIZE = 4096,
  MAX_LAYERS = 24,
  MAX_OBJECTS = 500;
export function blank(width = 900, height = 1200): Project {
  return {
    schemaVersion: 1,
    id: uid(),
    name: "ชิ้นงานใหม่",
    width,
    height,
    thickness: 0.55,
    layers: [layer("เลเยอร์ 1")],
  };
}
export function layer(name: string): DepthLayer {
  return {
    id: uid(),
    name,
    visible: true,
    locked: false,
    depth: 0.5,
    objects: [],
  };
}
export function baseObject(type: ArtObject["type"]): ArtObject {
  return {
    id: uid(),
    type,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 1,
  };
}
export function distribute(p: Project) {
  p.layers.forEach((l, i) => (l.depth = (i + 1) / (p.layers.length + 1)));
}
export function constrainDepth(p: Project, id: string, value: number) {
  const i = p.layers.findIndex((l) => l.id === id);
  if (i < 0) return;
  const gap = 0.008;
  const lo = i === 0 ? 0.04 : p.layers[i - 1].depth + gap;
  const hi = i === p.layers.length - 1 ? 0.96 : p.layers[i + 1].depth - gap;
  p.layers[i].depth = Math.max(lo, Math.min(hi, value));
}
export function imageObject(a: Asset, p: Project, fill = false): ArtObject {
  const scale = (fill ? Math.max : Math.min)(
    p.width / a.width,
    p.height / a.height,
  );
  const width = a.width * scale,
    height = a.height * scale;
  return {
    ...baseObject("image"),
    assetId: a.id,
    width,
    height,
    x: (p.width - width) / 2,
    y: (p.height - height) / 2,
  };
}
export function validateProject(
  value: unknown,
  assets: Assets,
): asserts value is Project {
  const p = value as Project;
  const fail = () => {
    throw new Error("ไฟล์โปรเจกต์ไม่ถูกต้อง หรือเกินขีดจำกัด");
  };
  if (
    !p ||
    p.schemaVersion !== 1 ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    p.name.length > 200
  )
    fail();
  if (
    ![p.width, p.height].every(
      (n) => Number.isInteger(n) && n >= 64 && n <= MAX_SIZE,
    ) ||
    !Number.isFinite(p.thickness) ||
    p.thickness < 0.1 ||
    p.thickness > 2
  )
    fail();
  if (
    !Array.isArray(p.layers) ||
    p.layers.length < 1 ||
    p.layers.length > MAX_LAYERS
  )
    fail();
  const ids = new Set<string>();
  let count = 0,
    last = -1;
  const id = (s: string) => {
    if (typeof s !== "string" || !s || s.length > 100 || ids.has(s)) fail();
    ids.add(s);
  };
  for (const l of p.layers) {
    id(l.id);
    if (
      typeof l.name !== "string" ||
      l.name.length > 200 ||
      typeof l.visible !== "boolean" ||
      typeof l.locked !== "boolean" ||
      !Number.isFinite(l.depth) ||
      l.depth < 0.03 ||
      l.depth > 0.97 ||
      l.depth <= last ||
      !Array.isArray(l.objects)
    )
      fail();
    last = l.depth;
    for (const o of l.objects) {
      id(o.id);
      if (
        ++count > MAX_OBJECTS ||
        !["image", "text", "stroke"].includes(o.type)
      )
        fail();
      if (
        ![o.x, o.y, o.width, o.height, o.rotation, o.opacity].every(
          Number.isFinite,
        ) ||
        Math.abs(o.x) > 100000 ||
        Math.abs(o.y) > 100000 ||
        o.width <= 0 ||
        o.height <= 0 ||
        o.width > 100000 ||
        o.height > 100000 ||
        Math.abs(o.rotation) > 36000 ||
        o.opacity < 0 ||
        o.opacity > 1
      )
        fail();
      if (o.type === "image" && (!o.assetId || !assets[o.assetId]))
        throw new Error("ไม่พบไฟล์ภาพที่ใช้อยู่ในงาน");
      if (
        o.type === "text" &&
        (typeof o.text !== "string" ||
          o.text.length > 10000 ||
          !Number.isFinite(o.fontSize) ||
          o.fontSize! < 1 ||
          o.fontSize! > 1000 ||
          !["Noto Sans Thai", "sans-serif", "serif"].includes(
            o.fontFamily || "",
          ) ||
          !["left", "center", "right"].includes(o.align || ""))
      )
        fail();
      if (
        o.type !== "image" &&
        (typeof o.fill !== "string" || !/^#[a-f0-9]{6}$/i.test(o.fill))
      )
        fail();
      if (
        o.type === "stroke" &&
        (!Array.isArray(o.points) ||
          o.points.length < 4 ||
          o.points.length > 40000 ||
          o.points.length % 2 !== 0 ||
          !o.points.every((n) => Number.isFinite(n) && Math.abs(n) < 100000) ||
          !Number.isFinite(o.strokeWidth) ||
          o.strokeWidth! < 1 ||
          o.strokeWidth! > 200)
      )
        fail();
    }
  }
}
