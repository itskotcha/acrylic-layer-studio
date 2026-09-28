import type { ArtObject } from "./model";
export function objectCenter(o: ArtObject) {
  const r = (o.rotation * Math.PI) / 180;
  return {
    x: o.x + (Math.cos(r) * o.width) / 2 - (Math.sin(r) * o.height) / 2,
    y: o.y + (Math.sin(r) * o.width) / 2 + (Math.cos(r) * o.height) / 2,
  };
}
export function rotateAboutCenter(o: ArtObject, angle: number): ArtObject {
  if (!Number.isFinite(angle)) return o;
  const rotation = ((angle % 360) + 360) % 360;
  if (rotation === o.rotation) return o;
  const c = objectCenter(o),
    r = (rotation * Math.PI) / 180;
  return {
    ...o,
    rotation,
    x: c.x - (Math.cos(r) * o.width) / 2 + (Math.sin(r) * o.height) / 2,
    y: c.y - (Math.sin(r) * o.width) / 2 - (Math.cos(r) * o.height) / 2,
  };
}
