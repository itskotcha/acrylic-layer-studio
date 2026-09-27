import Konva from "konva";
import { loadImage, download, safeName } from "./io";
import type { Project, DepthLayer, Assets } from "./model";
import JSZip from "jszip";
// Shared Konva renderer: same primitives and metrics as the interactive editor.
export async function rasterLayer(
  p: Project,
  l: DepthLayer,
  a: Assets,
  max = 4096,
): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const scale = Math.min(1, max / Math.max(p.width, p.height));
  const host = document.createElement("div");
  const stage = new Konva.Stage({
    container: host,
    width: p.width,
    height: p.height,
  });
  const layer = new Konva.Layer();
  stage.add(layer);
  try {
    for (const o of l.objects) {
      const attrs = { ...o, listening: false };
      if (o.type === "image") {
        const image = await loadImage(a[o.assetId!].data);
        layer.add(new Konva.Image({ ...attrs, image }));
      } else if (o.type === "text") {
        layer.add(
          new Konva.Text({
            ...attrs,
            text: o.text,
            fontFamily: o.fontFamily,
            lineHeight: 1.3,
          }),
        );
      } else {
        layer.add(
          new Konva.Line({
            ...attrs,
            points: o.points,
            stroke: o.fill,
            strokeWidth: o.strokeWidth,
            lineCap: "round",
            lineJoin: "round",
            fillEnabled: false,
            tension: 0,
          }),
        );
      }
    }
    layer.draw();
    return stage.toCanvas({ pixelRatio: scale });
  } finally {
    stage.destroy();
  }
}
export function canvasBlob(c: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("ส่งออกภาพไม่สำเร็จ"))),
      "image/png",
    ),
  );
}
export async function exportFlat(p: Project, a: Assets) {
  const c = document.createElement("canvas");
  c.width = p.width;
  c.height = p.height;
  const ctx = c.getContext("2d")!;
  for (const l of p.layers)
    if (l.visible) ctx.drawImage(await rasterLayer(p, l, a), 0, 0);
  download(await canvasBlob(c), `${safeName(p.name)}-front.png`);
}
export async function exportLayers(p: Project, a: Assets) {
  const zip = new JSZip();
  for (let i = 0; i < p.layers.length; i++) {
    const l = p.layers[i];
    zip.file(
      `${String(i + 1).padStart(2, "0")}-${safeName(l.name)}.png`,
      await canvasBlob(await rasterLayer(p, l, a)),
    );
  }
  download(
    await zip.generateAsync({ type: "blob" }),
    `${safeName(p.name)}-layers.zip`,
  );
}
