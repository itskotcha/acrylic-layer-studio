import { migrateProject } from "./migrate";
import { ensureFonts, missingFonts } from "./fonts";
import JSZip from "jszip";
import { get, set } from "idb-keyval";
import {
  uid,
  validateProject,
  type Project,
  type Assets,
  type Asset,
} from "./model";
export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("อ่านรูปภาพไม่สำเร็จ"));
    im.src = src;
  });
export const blobData = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(b);
  });
export async function readImage(file: File): Promise<Asset> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("รองรับ PNG, JPEG และ WebP เท่านั้น");
  if (file.size > 20 * 1024 * 1024) throw new Error("ภาพต้องไม่เกิน 20 MB");
  const data = await blobData(file);
  const im = await loadImage(data);
  if (im.width * im.height > 32e6)
    throw new Error("ภาพต้องไม่เกิน 32 ล้านพิกเซล");
  return {
    id: uid(),
    name: file.name,
    mime: file.type,
    width: im.width,
    height: im.height,
    data,
  };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function safeName(s: string) {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80) || "artwork";
}
export function usedAssets(p: Project, a: Assets): Assets {
  const ids = new Set(
    p.layers.flatMap((l) =>
      l.objects.flatMap((o) => (o.assetId ? [o.assetId] : [])),
    ),
  );
  return Object.fromEntries([...ids].map((id) => [id, a[id]]));
}
export async function packProject(
  p: Project,
  assets: Assets,
  embedFonts = true,
) {
  validateProject(p, assets);
  const zip = new JSZip();
  const a = usedAssets(p, assets);
  const manifest: Record<string, unknown> = {};
  for (const [id, asset] of Object.entries(a)) {
    const { data, ...meta } = asset;
    const path = `assets/${id}.bin`;
    zip.file(path, data.split(",")[1], { base64: true });
    manifest[id] = { ...meta, path };
  }
  const project = structuredClone(p);
  for (const f of Object.values(project.fonts)) {
    if (embedFonts && f.data)
      zip.file(`fonts/${f.id}.${f.extension}`, f.data.split(",")[1], {
        base64: true,
      });
    delete f.data;
  }
  zip.file(
    "project.json",
    JSON.stringify({ project, assets: manifest }, null, 2),
  );
  return zip.generateAsync({ type: "blob" });
}
export async function unpackProject(
  file: Blob,
): Promise<{ project: Project; assets: Assets }> {
  if (file.size > 120 * 1024 * 1024)
    throw new Error("โปรเจกต์ต้องไม่เกิน 120 MB");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.file("project.json");
  if (!entry) throw new Error("ไม่มี project.json");
  const raw = await entry.async("string");
  if (raw.length > 20e6) throw new Error("ข้อมูลโปรเจกต์ใหญ่เกินไป");
  const parsed = JSON.parse(raw);
  if (
    !parsed.assets ||
    typeof parsed.assets !== "object" ||
    Array.isArray(parsed.assets) ||
    Object.keys(parsed.assets).length > 100
  )
    throw new Error("รายการ assets ไม่ถูกต้อง");
  const assets: Assets = {};
  let total = 0;
  for (const [id, v] of Object.entries(parsed.assets)) {
    const m = v as Asset & { path: string };
    if (
      !/^[a-zA-Z0-9-]+$/.test(id) ||
      m.id !== id ||
      !["image/png", "image/jpeg", "image/webp"].includes(m.mime) ||
      m.path !== `assets/${id}.bin`
    )
      throw new Error("ข้อมูลภาพไม่ถูกต้อง");
    const e = zip.file(m.path);
    if (!e) throw new Error("ไฟล์ภาพในโปรเจกต์ไม่ครบ");
    const bytes = await e.async("uint8array");
    total += bytes.byteLength;
    if (bytes.byteLength > 20e6 || total > 120e6)
      throw new Error("ข้อมูลภาพใหญ่เกินขีดจำกัด");
    const data = await blobData(
      new Blob([bytes as BlobPart], { type: m.mime }),
    );
    const im = await loadImage(data);
    if (im.width * im.height > 32e6)
      throw new Error("ความละเอียดภาพเกินขีดจำกัด");
    assets[id] = {
      id,
      name: String(m.name).slice(0, 200),
      mime: m.mime,
      width: im.width,
      height: im.height,
      data,
    };
  }
  const project = migrateProject(parsed.project, assets);
  for (const f of Object.values(project.fonts)) {
    const file = zip.file(`fonts/${f.id}.${f.extension}`);
    if (file) {
      const bytes = await file.async("uint8array");
      if (bytes.length > 10e6) throw new Error("ฟอนต์ใหญ่เกิน 10 MB");
      f.data = await blobData(
        new Blob([bytes as BlobPart], { type: "application/octet-stream" }),
      );
    }
  }
  if (!missingFonts(project).length) await ensureFonts(project);
  return { project, assets };
}
export async function saveLocal(p: Project, a: Assets) {
  await set("acrylic-studio-v2", { project: p, assets: usedAssets(p, a) });
}
export async function restoreLocal() {
  const saved =
    (await get("acrylic-studio-v2")) || (await get("acrylic-studio-v1"));
  if (saved) {
    saved.project = migrateProject(saved.project, saved.assets);
    await ensureFonts(saved.project);
    return saved as { project: Project; assets: Assets };
  }
  return null;
}
