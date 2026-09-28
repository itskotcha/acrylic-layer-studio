import type { Project, FontAsset } from "./model";
export const BUILTIN_FONTS = [
  { family: "Noto Sans Thai", category: "เรียบ", thai: true },
  { family: "Sarabun", category: "ทางการ", thai: true },
  { family: "Mali", category: "ลายมือ", thai: true },
  { family: "Chonburi", category: "ตกแต่ง", thai: true },
  { family: "sans-serif", category: "ระบบ", thai: false },
  { family: "serif", category: "ระบบ", thai: false },
];
const loaded = new Map<string, { face: FontFace; data: string }>();
export async function loadCustomFont(f: FontAsset) {
  if (!f.data)
    throw new Error(`ขาดฟอนต์ ${f.name} กรุณานำเข้าหรือเลือกฟอนต์แทน`);
  const existing = loaded.get(f.id);
  if (existing?.data === f.data) return;
  const bytes = await (await fetch(f.data)).arrayBuffer();
  const face = new FontFace(f.family, bytes, {
    weight: f.weight,
    style: f.style,
  });
  await face.load();
  if (existing) document.fonts.delete(existing.face);
  document.fonts.add(face);
  loaded.set(f.id, { face, data: f.data });
}
export function releaseUnusedFonts(fonts: Record<string, FontAsset>) {
  for (const [id, v] of loaded)
    if (!fonts[id]) {
      document.fonts.delete(v.face);
      loaded.delete(id);
    }
}
export async function readFont(
  file: File,
  reuse?: FontAsset,
  descriptor = { weight: "400", style: "normal" as "normal" | "italic" },
): Promise<FontAsset> {
  const ext = file.name.split(".").at(-1)?.toLowerCase() || "";
  if (!["ttf", "otf", "woff", "woff2"].includes(ext) || file.size > 10e6)
    throw new Error("ฟอนต์ต้องเป็น TTF/OTF/WOFF/WOFF2 และไม่เกิน 10 MB");
  const id = reuse?.id || crypto.randomUUID();
  const bytes = await file.arrayBuffer();
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(new Blob([bytes], { type: "application/octet-stream" }));
  });
  const f: FontAsset = {
    id,
    family: "custom-" + id,
    name: reuse?.name || file.name.slice(0, 180),
    data,
    extension: ext,
    weight: reuse?.weight || descriptor.weight,
    style: reuse?.style || descriptor.style,
  };
  await loadCustomFont(f);
  return f;
}
export async function ensureFonts(p: Project) {
  const used = new Set(
    p.layers.flatMap((l) =>
      l.objects.filter((o) => o.type === "text").map((o) => o.fontFamily!),
    ),
  );
  for (const f of Object.values(p.fonts))
    if (used.has(f.family)) await loadCustomFont(f);
  await Promise.all(
    [...used].map((f) => {
      const custom = Object.values(p.fonts).find((x) => x.family === f);
      return document.fonts.load(
        `${custom?.style || "normal"} ${custom?.weight || "400"} 16px "${f}"`,
        "ภาษาไทย ABC",
      );
    }),
  );
  await document.fonts.ready;
}
export function missingFonts(p: Project) {
  const used = new Set(
    p.layers.flatMap((l) => l.objects.map((o) => o.fontFamily)),
  );
  return Object.values(p.fonts).filter((f) => used.has(f.family) && !f.data);
}

export function fontStyle(p: Project, family?: string) {
  const f = Object.values(p.fonts).find((f) => f.family === family);
  return f ? `${f.style} ${f.weight}` : "normal";
}
