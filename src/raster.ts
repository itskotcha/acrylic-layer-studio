import Konva from "konva";
import { loadImage, download, safeName } from "./io";
import {
  outputSize,
  type Project,
  type DepthLayer,
  type Assets,
} from "./model";
import { ensureFonts, fontStyle } from "./fonts";
import { backgroundAttrs, makeStrokeShape, textRenderAttrs } from "./rendering";
import JSZip from "jszip";
export async function rasterLayer(
  p: Project,
  l: DepthLayer,
  a: Assets,
  longEdge = 2048,
): Promise<HTMLCanvasElement> {
  await ensureFonts(p);
  const out = outputSize(p, longEdge),
    sx = out.width / p.width,
    sy = out.height / p.height;
  const stage = new Konva.Stage({
    container: document.createElement("div"),
    width: out.width,
    height: out.height,
  });
  const layer = new Konva.Layer({ listening: false });
  layer.getCanvas().setPixelRatio(1);
  const group = new Konva.Group({ scaleX: sx, scaleY: sy });
  stage.add(layer);
  layer.add(group);
  try {
    for (const o of l.objects) {
      const attrs = { ...o, listening: false };
      if (o.type === "image")
        group.add(
          new Konva.Image({
            ...attrs,
            image: await loadImage(a[o.assetId!].data),
          }),
        );
      else if (o.type === "text") {
        const textGroup = new Konva.Group(attrs);
        textGroup.add(
          new Konva.Text({
            ...textRenderAttrs(o),
            fontStyle: fontStyle(p, o.fontFamily),
            listening: false,
          }),
        );
        group.add(textGroup);
      } else if (o.type === "background")
        group.add(new Konva.Rect({ ...attrs, ...backgroundAttrs(o) }));
      else group.add(makeStrokeShape(o, Math.max(sx, sy)));
    }
    layer.draw();
    return stage.toCanvas({ pixelRatio: 1 });
  } finally {
    stage.destroy();
  }
}
export const canvasBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("ส่งออกภาพไม่สำเร็จ"))),
      "image/png",
    ),
  );
export async function flatCanvas(p: Project, a: Assets, edge = 2048) {
  const out = outputSize(p, edge),
    c = document.createElement("canvas");
  c.width = out.width;
  c.height = out.height;
  for (const l of p.layers)
    if (l.visible)
      c.getContext("2d")!.drawImage(await rasterLayer(p, l, a, edge), 0, 0);
  return c;
}
export async function exportFlat(p: Project, a: Assets, edge = 2048) {
  download(
    await canvasBlob(await flatCanvas(p, a, edge)),
    `${safeName(p.name)}-${edge}-front.png`,
  );
}
export async function exportLayers(p: Project, a: Assets, edge = 2048) {
  const zip = new JSZip();
  for (let i = 0; i < p.layers.length; i++) {
    const l = p.layers[i];
    zip.file(
      `${String(i + 1).padStart(2, "0")}-${safeName(l.name)}.png`,
      await canvasBlob(await rasterLayer(p, l, a, edge)),
    );
  }
  download(
    await zip.generateAsync({ type: "blob" }),
    `${safeName(p.name)}-${edge}-layers.zip`,
  );
}
