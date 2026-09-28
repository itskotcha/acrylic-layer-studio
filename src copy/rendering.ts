import Konva from "konva";
import type { ArtObject } from "./model";
import { strokeCanvas } from "./brushes";
export function backgroundAttrs(o: ArtObject) {
  const angle = ((o.gradientAngle || 0) * Math.PI) / 180;
  const dx = (Math.cos(angle) * o.width) / 2,
    dy = (Math.sin(angle) * o.height) / 2;
  return {
    fill: o.fill,
    fillPriority: o.backgroundMode === "gradient" ? "linear-gradient" : "color",
    fillLinearGradientStartPoint: { x: o.width / 2 - dx, y: o.height / 2 - dy },
    fillLinearGradientEndPoint: { x: o.width / 2 + dx, y: o.height / 2 + dy },
    fillLinearGradientColorStops: [0, o.fill!, 1, o.fill2!],
    opacity: o.backgroundMode === "transparent" ? 0 : o.opacity,
  };
}
export function makeStrokeShape(o: ArtObject, scale: number) {
  return new Konva.Shape({
    ...o,
    listening: false,
    sceneFunc: (ctx) => {
      ctx.drawImage(strokeCanvas(o, scale), 0, 0, o.width, o.height);
    },
  });
}

// Measure text at a stable em size instead of tiny (e.g. 2-unit) CSS font sizes.
// The inverse transform keeps project coordinates unchanged and glyphs are still
// rasterized directly into the destination canvas at its output resolution.
export function textRenderAttrs(o: ArtObject) {
  const k = 64 / Math.max(0.01, o.fontSize || 1);
  return {
    text: o.text,
    fontFamily: o.fontFamily,
    fontSize: 64,
    width: o.width * k,
    height: o.height * k,
    scaleX: 1 / k,
    scaleY: 1 / k,
    fill: o.fill,
    align: o.align,
    lineHeight: 1.3,
  };
}
