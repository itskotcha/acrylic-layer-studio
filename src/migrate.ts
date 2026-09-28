import { normalizeStroke } from "./brushes";
import { validateProject as validateLegacy } from "./legacy-model";
import {
  clone,
  scaleObject,
  validateProject,
  type Project,
  type Assets,
} from "./model";
export function migrateProject(value: unknown, assets: Assets): Project {
  const raw = clone(value) as any;
  if (raw?.schemaVersion === 1) {
    validateLegacy(raw, assets);
    const scale = 100 / Math.max(raw.width, raw.height);
    const p: Project = {
      ...raw,
      schemaVersion: 2,
      fonts: {},
      width: raw.width * scale,
      height: raw.height * scale,
      layers: raw.layers.map((l: any) => ({
        ...l,
        objects: l.objects.map((o: any) => ({
          ...scaleObject(o.type === "stroke" ? normalizeStroke(o) : o, scale),
          locked: false,
          ...(o.type === "stroke"
            ? { brushType: "round", brushVersion: 1, seed: 1, erasures: [] }
            : {}),
        })),
      })),
    };
    validateProject(p, assets);
    return p;
  }
  validateProject(raw, assets);
  return raw;
}
