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

import { outputSize, scaleObject } from "../src/model";
import { migrateProject } from "../src/migrate";
import { duplicateObject, deleteObject } from "../src/store";
describe("v2 units, migration and masks", () => {
  it("exports longest edge with consistent integer rounding", () => {
    expect(outputSize(blank(100, 100), 2048)).toEqual({
      width: 2048,
      height: 2048,
    });
    expect(outputSize(blank(100, 150), 2048)).toEqual({
      width: 1365,
      height: 2048,
    });
    expect(outputSize(blank(1, 2), 4096)).toEqual({
      width: 2048,
      height: 4096,
    });
  });
  it("migrates legacy rotated strokes preserving world coordinates and depths", () => {
    const old: any = { ...blank(900, 1200), schemaVersion: 1 };
    delete old.fonts;
    const o = {
      ...baseObject("stroke"),
      x: 100,
      y: 700,
      width: 180,
      height: 20,
      points: [0, -10, 180, 0],
      fill: "#000000",
      strokeWidth: 5,
      rotation: 30,
    };
    old.layers[0].objects = [o];
    const p = migrateProject(old, {}),
      n = p.layers[0].objects[0];
    const world = (v: any) => ({
      x:
        v.x +
        v.points[0] * Math.cos((v.rotation * Math.PI) / 180) -
        v.points[1] * Math.sin((v.rotation * Math.PI) / 180),
      y:
        v.y +
        v.points[0] * Math.sin((v.rotation * Math.PI) / 180) +
        v.points[1] * Math.cos((v.rotation * Math.PI) / 180),
    });
    expect(world(n).x).toBeCloseTo(world(o).x / 12);
    expect(world(n).y).toBeCloseTo(world(o).y / 12);
    expect(n.points![1]).toBeGreaterThan(0);
    expect(p.layers[0].depth).toBe(old.layers[0].depth);
    expect(old.schemaVersion).toBe(1);
    expect(old.width).toBe(900);
  });
  it("scales erasure coordinates and widths together with strokes", () => {
    const o = {
      ...baseObject("stroke"),
      width: 20,
      height: 10,
      points: [1, 2, 10, 5],
      strokeWidth: 2,
      erasures: [{ width: 3, points: [2, 3, 4, 5] }],
    };
    const n = scaleObject(o, 3);
    expect(n.points).toEqual([3, 6, 30, 15]);
    expect(n.erasures).toEqual([{ width: 9, points: [6, 9, 12, 15] }]);
    expect(o.erasures[0].width).toBe(3);
  });
  it("object lock prevents editing/deleting but allows unlock and independent duplication", () => {
    const p = blank();
    const o = { ...baseObject("text"), locked: true };
    p.layers[0].objects = [o];
    const s = useStudio.getState();
    s.replace(p, {});
    s.select(p.layers[0].id, o.id);
    s.patchObject({ x: 10 });
    deleteObject();
    expect(useStudio.getState().project.layers[0].objects[0].x).toBe(0);
    s.select(p.layers[0].id, o.id);
    duplicateObject();
    const a = useStudio.getState();
    expect(a.project.layers[0].objects).toHaveLength(2);
    expect(a.objectId).not.toBe(o.id);
    expect(a.project.layers[0].objects[1].locked).toBe(false);
    s.select(p.layers[0].id, o.id);
    s.patchObject({ locked: false });
    s.patchObject({ x: 10 });
    expect(useStudio.getState().project.layers[0].objects[0].x).toBe(10);
  });
});
