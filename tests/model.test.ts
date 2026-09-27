import { describe, it, expect, beforeEach } from "vitest";
import {
  blank,
  layer,
  distribute,
  constrainDepth,
  validateProject,
  baseObject,
  imageObject,
} from "../src/model";
import { useStudio } from "../src/store";
describe("depth constraints", () => {
  it("keeps sorted layers inside the block when clamped and thickness changes", () => {
    const p = blank();
    p.layers = [layer("a"), layer("b"), layer("c")];
    distribute(p);
    constrainDepth(p, p.layers[1].id, 100);
    expect(p.layers[1].depth).toBeLessThan(p.layers[2].depth);
    constrainDepth(p, p.layers[0].id, -20);
    expect(p.layers[0].depth).toBe(0.04);
    p.thickness = 0.1;
    for (const l of p.layers)
      expect(Math.abs((l.depth - 0.5) * p.thickness)).toBeLessThan(
        p.thickness / 2,
      );
    validateProject(p, {});
  });
  it("rejects missing assets and duplicate IDs", () => {
    const p = blank();
    p.layers[0].objects.push({ ...baseObject("image"), assetId: "missing" });
    expect(() => validateProject(p, {})).toThrow();
    p.layers[0].objects = [];
    p.layers.push({ ...layer("b"), id: p.layers[0].id, depth: 0.8 });
    expect(() => validateProject(p, {})).toThrow();
  });
  it("fit and fill preserve image proportions", () => {
    const p = blank(900, 1200),
      a = {
        id: "x",
        name: "x",
        mime: "image/png",
        width: 1000,
        height: 500,
        data: "",
      };
    const fit = imageObject(a, p),
      fill = imageObject(a, p, true);
    expect(fit.width / fit.height).toBe(2);
    expect(fit.width).toBe(900);
    expect(fill.height).toBe(1200);
    expect(fill.x).toBeLessThan(0);
  });
});
describe("history", () => {
  beforeEach(() => useStudio.getState().replace(blank(), {}));
  it("undo/redo restores mutations without sharing object state", () => {
    const s = useStudio.getState();
    s.change((p) => {
      p.name = "first";
    });
    s.change((p) => {
      p.name = "second";
    });
    s.undo();
    expect(useStudio.getState().project.name).toBe("first");
    s.redo();
    expect(useStudio.getState().project.name).toBe("second");
    s.undo();
    s.change((p) => {
      p.name = "branch";
    });
    expect(useStudio.getState().future).toHaveLength(0);
  });
  it("locked objects cannot be patched", () => {
    const s = useStudio.getState(),
      id = s.project.layers[0].id;
    const o = baseObject("image");
    s.change((p) => {
      p.layers[0].objects = [o];
      p.layers[0].locked = true;
    });
    s.select(id, o.id);
    s.patchObject({ x: 900 });
    expect(useStudio.getState().project.layers[0].objects[0].x).toBe(0);
  });
});
