import { create } from "zustand";
import {
  blank,
  clone,
  distribute,
  layer,
  uid,
  MAX_LAYERS,
  type Project,
  type Assets,
  type ArtObject,
} from "./model";
type State = {
  project: Project;
  assets: Assets;
  past: Project[];
  future: Project[];
  layerId: string;
  objectId: string | null;
  revision: number;
  change: (fn: (p: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  replace: (p: Project, a: Assets) => void;
  addAssets: (a: Assets) => void;
  select: (l: string, o?: string | null) => void;
  patchObject: (patch: Partial<ArtObject>) => void;
  addLayer: () => void;
};
const initial = blank();
export const useStudio = create<State>((set, get) => ({
  project: initial,
  assets: {},
  past: [],
  future: [],
  layerId: initial.layers[0].id,
  objectId: null,
  revision: 0,
  change: (fn) =>
    set((s) => {
      const p = clone(s.project);
      fn(p);
      if (JSON.stringify(p) === JSON.stringify(s.project)) return s;
      return {
        project: p,
        past: [...s.past.slice(-39), s.project],
        future: [],
        revision: s.revision + 1,
      };
    }),
  undo: () =>
    set((s) =>
      s.past.length
        ? {
            project: s.past.at(-1)!,
            past: s.past.slice(0, -1),
            future: [s.project, ...s.future],
            objectId: null,
            revision: s.revision + 1,
          }
        : s,
    ),
  redo: () =>
    set((s) =>
      s.future.length
        ? {
            project: s.future[0],
            past: [...s.past, s.project],
            future: s.future.slice(1),
            objectId: null,
            revision: s.revision + 1,
          }
        : s,
    ),
  replace: (p, a) =>
    set((s) => ({
      project: p,
      assets: a,
      past: [],
      future: [],
      layerId: p.layers[0].id,
      objectId: null,
      revision: s.revision + 1,
    })),
  addAssets: (a) => set((s) => ({ assets: { ...s.assets, ...a } })),
  select: (l, o = null) => set({ layerId: l, objectId: o }),
  patchObject: (patch) => {
    const s = get();
    s.change((p) => {
      const l = p.layers.find((l) => l.id === s.layerId);
      if (l?.locked) return;
      const o = l?.objects.find((o) => o.id === s.objectId);
      if (
        o &&
        (!o.locked ||
          (Object.keys(patch).length === 1 && patch.locked === false))
      )
        Object.assign(o, patch);
    });
  },
  addLayer: () => {
    if (get().project.layers.length >= MAX_LAYERS)
      throw new Error("รองรับไม่เกิน 24 เลเยอร์");
    const l = layer("เลเยอร์ใหม่");
    get().change((p) => {
      p.layers.push(l);
      distribute(p);
    });
    get().select(l.id);
  },
}));
export function duplicateObject() {
  const s = useStudio.getState();
  let newId: string | undefined;
  s.change((p) => {
    const l = p.layers.find((l) => l.id === s.layerId);
    const o = l?.objects.find((o) => o.id === s.objectId);
    if (
      o &&
      o.type !== "background" &&
      l &&
      !l.locked &&
      p.layers.reduce((n, l) => n + l.objects.length, 0) < 500
    ) {
      newId = uid();
      l.objects.push({
        ...clone(o),
        id: newId,
        locked: false,
        x: o.x + p.width * 0.025,
        y: o.y + p.height * 0.025,
      });
    }
  });
  if (newId) s.select(s.layerId, newId);
}
export function deleteObject() {
  const s = useStudio.getState();
  s.change((p) => {
    const l = p.layers.find((l) => l.id === s.layerId);
    if (l && !l.locked)
      l.objects = l.objects.filter((o) => o.id !== s.objectId || o.locked);
  });
  s.select(s.layerId);
}
