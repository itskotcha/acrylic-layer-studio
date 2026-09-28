import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
async function boot(page: any) {
  page.on("dialog", (d: any) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "กลับไปดูงานในสตูดิโอ" }).click();
  await page.evaluate(() => document.fonts.ready);
}
async function theme(page: any, value: string) {
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await page.getByLabel("ธีม", { exact: true }).selectOption(value);
  await page.getByRole("button", { name: "ปิดตั้งค่า", exact: true }).click();
}
async function state(page: any) {
  return page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const s = useStudio.getState();
    return { project: structuredClone(s.project), history: s.past.length };
  });
}
async function camera(page: any) {
  return page.evaluate(async () => {
    const { _roots } =
      await import("/node_modules/.vite/deps/@react-three_fiber.js");
    const c = document.querySelector("[data-testid=preview] canvas");
    const s = _roots.get(c).store.getState();
    return {
      position: s.camera.position.toArray(),
      quaternion: s.camera.quaternion.toArray(),
      zoom: s.camera.zoom,
    };
  });
}
async function select(page: any, type: string) {
  await page.evaluate(async (type) => {
    const { useStudio } = await import("/src/store.ts");
    const s = useStudio.getState();
    for (const l of s.project.layers) {
      const o = l.objects.find((o) => o.type === type);
      if (o) {
        s.select(l.id, o.id);
        return;
      }
    }
  }, type);
}
async function contrastFailures(page: any) {
  return page.evaluate(() => {
    function rgb(s: string) {
      return s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    }
    function lum(c: number[]) {
      const a = c.slice(0, 3).map((v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    const failures: any[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      "button,select,input:not([type=range]):not([type=color]):not([type=checkbox]),textarea,.preview-hint,small,summary,.layer-caption,.button.primary,.field,.tip,.toast",
    )) {
      if (
        !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
        (el as HTMLButtonElement).disabled ||
        el.closest("fieldset:disabled") ||
        el.getBoundingClientRect().width === 0
      )
        continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      if (!el.textContent?.trim() && !el.matches("input,select,textarea"))
        continue;
      let parent: HTMLElement | null = el,
        bg = [255, 255, 255];
      while (parent) {
        const c = rgb(getComputedStyle(parent).backgroundColor);
        if (c.length === 3 || c[3] === 1) {
          bg = c;
          break;
        }
        parent = parent.parentElement;
      }
      const fg = rgb(getComputedStyle(el).color),
        a = lum(fg),
        b = lum(bg),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 4.5)
        failures.push({
          text: (
            el.textContent ||
            el.getAttribute("aria-label") ||
            el.tagName
          ).slice(0, 45),
          ratio,
          fg,
          bg,
        });
    }
    return failures;
  });
}
test("v3 light/dark layout and readable controls at all target sizes", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const t of ["light", "dark"]) {
      await theme(page, t);
      await page
        .getByRole("button", { name: "ออกแบบ 2D", exact: true })
        .click();
      expect(await contrastFailures(page)).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${size.width}-${t}-2d.png`),
      });
      await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
      expect(await contrastFailures(page)).toEqual([]);
      await page
        .getByRole("button", { name: "ปิดตั้งค่า", exact: true })
        .click();
      await page.getByRole("button", { name: "ดูแบบ 3D", exact: true }).click();
      await expect(page.getByTestId("preview").locator("canvas")).toBeVisible();
      await page.waitForTimeout(900);
      expect(await contrastFailures(page)).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${size.width}-${t}-3d.png`),
      });
      if (size.width === 390) {
        await page
          .getByRole("button", { name: "คุณสมบัติ", exact: true })
          .click();
        expect(await contrastFailures(page)).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`mobile-${t}-properties.png`),
        });
        await page.getByRole("button", { name: "ปิดคุณสมบัติ" }).click();
      }
    }
  }
  expect(errors).toEqual([]);
});
test("v3 rotation center, preview history, undo redo, locks, masks and save roundtrip", async ({
  page,
}, info) => {
  await boot(page);
  await select(page, "image");
  await page.getByLabel("หมุนวัตถุ", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "หมุนวัตถุ 360 องศา" });
  const before = await state(page);
  const slider = dialog.getByLabel("เลื่อนมุมหมุน");
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, {
    steps: 15,
  });
  expect((await state(page)).history).toBe(before.history);
  const preview = await page.evaluate(async () => {
    const { useRotationPreview } =
      await import("/src/components/RotationControl.tsx");
    return useRotationPreview.getState().object?.rotation;
  });
  expect(preview).toBeGreaterThan(200);
  await page.mouse.up();
  expect((await state(page)).history).toBe(before.history + 1);
  await page.getByTitle("ย้อนกลับ", { exact: true }).click();
  expect((await state(page)).project).toEqual(before.project);
  await page.getByTitle("ทำซ้ำ", { exact: true }).click();
  await select(page, "image");
  await page.getByLabel("หมุนวัตถุ", { exact: true }).click();
  for (const angle of [0, 45, 90, 180, 270, 360]) {
    await dialog.getByLabel("มุมหมุน °", { exact: true }).fill(String(angle));
    await dialog.getByLabel("มุมหมุน °", { exact: true }).press("Enter");
    const data = await page.evaluate(async () => {
      const { useStudio } = await import("/src/store.ts");
      const { objectCenter } = await import("/src/geometry.ts");
      const s = useStudio.getState(),
        o = s.project.layers
          .flatMap((l) => l.objects)
          .find((o) => o.id === s.objectId)!;
      return { center: objectCenter(o), o };
    });
    const old = before.project.layers
      .flatMap((l: any) => l.objects)
      .find((o: any) => o.id === data.o.id);
    const r = (old.rotation * Math.PI) / 180;
    expect(data.center.x).toBeCloseTo(
      old.x + (Math.cos(r) * old.width) / 2 - (Math.sin(r) * old.height) / 2,
      8,
    );
    expect(data.center.y).toBeCloseTo(
      old.y + (Math.sin(r) * old.width) / 2 + (Math.cos(r) * old.height) / 2,
      8,
    );
    expect(data.o.width).toBe(old.width);
    expect(data.o.rotation).toBe(angle % 360);
  }
  await page.getByLabel("ปิดการหมุน").click();
  await page
    .getByTestId("object-toolbar")
    .getByLabel("ล็อกวัตถุ", { exact: true })
    .click();
  await expect(page.getByLabel("หมุนวัตถุ", { exact: true })).toBeDisabled();
  await page
    .getByTestId("object-toolbar")
    .getByLabel("ปลดล็อกวัตถุ", { exact: true })
    .click();
  const result = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { packProject, unpackProject } = await import("/src/io.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState(),
      blob = await packProject(s.project, s.assets, true),
      loaded = await unpackProject(new File([blob], "test.zip"));
    return {
      equal: JSON.stringify(loaded.project) === JSON.stringify(s.project),
      pixels:
        (await flatCanvas(loaded.project, loaded.assets, 1024)).toDataURL() ===
        (await flatCanvas(s.project, s.assets, 1024)).toDataURL(),
    };
  });
  expect(result).toEqual({ equal: true, pixels: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("หมุนวัตถุ", { exact: true }).click();
  await theme(page, "dark");
  await page.screenshot({ path: info.outputPath("mobile-dark-rotation.png") });
  const rect = (await dialog.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(390);
  expect(rect.y).toBeGreaterThanOrEqual(0);
});
test("v3 keeps 2D view and 3D camera across mode switches and export", async ({
  page,
}, info) => {
  await boot(page);
  await page.getByLabel("ซูมเข้า", { exact: true }).click();
  await page.getByRole("button", { name: "เลื่อนผืนงาน", exact: true }).click();
  const b = (await page.getByTestId("editor").boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 25, {
    steps: 6,
  });
  await page.mouse.up();
  const board = await page.locator(".artboard").boundingBox();
  await page.getByRole("button", { name: "ดูแบบ 3D", exact: true }).click();
  await page.waitForTimeout(1500);
  const c = (await page
    .getByTestId("preview")
    .locator("canvas")
    .boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width * 0.75, c.y + c.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const cam = await camera(page);
  await page.getByRole("button", { name: "ออกแบบ 2D", exact: true }).click();
  expect(await page.locator(".artboard").boundingBox()).toEqual(board);
  await page.getByRole("button", { name: "ดูแบบ 3D", exact: true }).click();
  await page.waitForTimeout(1500);
  const restored = await camera(page);
  for (let i = 0; i < 3; i++)
    expect(restored.position[i]).toBeCloseTo(cam.position[i], 5);
  expect(restored.zoom).toBeCloseTo(cam.zoom, 5);
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "บันทึกภาพ 3D", exact: true }).click();
  const file = info.outputPath("v3-camera.png");
  await (await d).saveAs(file);
  const png = await fs.readFile(file);
  expect(Math.max(png.readUInt32BE(16), png.readUInt32BE(20))).toBe(2048);
  expect(await camera(page)).toEqual(restored);
  await page.getByRole("button", { name: "ออกแบบ 2D", exact: true }).click();
  await page.getByTitle("พอดีหน้าจอ").click();
  await expect(page.getByLabel("ระดับซูม")).toHaveText("100%");
});
test("v3 text and masked strokes rotate correctly; multilayer editing and repeated previews remain usable", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  const begin = Date.now();
  await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { baseObject, layer, distribute, uid } =
      await import("/src/model.ts");
    const { makeDemo } = await import("/src/demo.ts");
    const d = makeDemo();
    const asset = Object.values(d.assets)[0];
    d.project.name = "v3 stability · 12 layers / 96 objects";
    d.project.layers = Array.from({ length: 12 }, (_, i) => {
      const l = layer("ชั้น " + (i + 1));
      l.objects = Array.from({ length: 8 }, (_, j) => ({
        ...baseObject("image"),
        id: uid(),
        assetId: asset.id,
        x: 3 + j * 8,
        y: 5 + i * 6,
        width: 8,
        height: 10,
      }));
      return l;
    });
    distribute(d.project);
    const l = d.project.layers[0];
    l.objects[0] = {
      ...baseObject("text"),
      x: 15,
      y: 18,
      width: 30,
      height: 15,
      rotation: 37,
      text: "ทดสอบ ABC",
      fontFamily: "Mali",
      fontSize: 5,
      fill: "#273e47",
      align: "left",
    };
    l.objects[1] = {
      ...baseObject("stroke"),
      x: 21,
      y: 45,
      width: 24,
      height: 14,
      rotation: 23,
      points: [2, 3, 10, 7, 20, 10],
      strokeWidth: 3,
      fill: "#d84465",
      brushType: "round",
      brushVersion: 1,
      seed: 12,
      erasures: [{ points: [8, 3, 8, 12], width: 3 }],
    };
    useStudio.getState().replace(d.project, d.assets);
  });
  for (const type of ["text", "stroke"]) {
    await select(page, type);
    const start = await state(page),
      o = start.project.layers[0].objects.find((o: any) => o.type === type);
    if (type === "text")
      await page.getByLabel("ฟอนต์", { exact: true }).selectOption("Sarabun");
    for (const angle of [0, 45, 90, 180, 270, 360]) {
      const input = page
        .locator(".properties")
        .getByLabel("มุมหมุน °", { exact: true });
      await input.fill(String(angle));
      await input.press("Enter");
      const next = (await state(page)).project.layers[0].objects.find(
        (n: any) => n.id === o.id,
      );
      const center = (v: any) => {
        const r = (v.rotation * Math.PI) / 180;
        return [
          v.x + (Math.cos(r) * v.width) / 2 - (Math.sin(r) * v.height) / 2,
          v.y + (Math.sin(r) * v.width) / 2 + (Math.cos(r) * v.height) / 2,
        ];
      };
      expect(center(next)[0]).toBeCloseTo(center(o)[0], 9);
      expect(center(next)[1]).toBeCloseTo(center(o)[1], 9);
      expect(next.width).toBe(o.width);
      expect(next.height).toBe(o.height);
      expect(next.erasures).toEqual(o.erasures);
    }
  }
  const roundtrip = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { packProject, unpackProject } = await import("/src/io.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState(),
      start = performance.now(),
      saved = await unpackProject(await packProject(s.project, s.assets));
    const a = (await flatCanvas(s.project, s.assets, 1024)).toDataURL(),
      b = (await flatCanvas(saved.project, saved.assets, 1024)).toDataURL();
    return {
      equal: a === b,
      objects: saved.project.layers.reduce((n, l) => n + l.objects.length, 0),
      elapsedMs: performance.now() - start,
    };
  });
  expect(roundtrip.equal).toBe(true);
  expect(roundtrip.objects).toBe(96);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "ดูแบบ 3D", exact: true }).click();
    await expect(page.getByTestId("preview").locator("canvas")).toBeVisible();
    await page.waitForTimeout(1300);
    if (i === 2)
      await page.screenshot({
        path: info.outputPath("stability-12-layers.png"),
      });
    await page.getByRole("button", { name: "ออกแบบ 2D", exact: true }).click();
    await expect(page.getByTestId("editor").locator("canvas")).toBeVisible();
  }
  await page.getByTitle("ย้อนกลับ", { exact: true }).click();
  await page.getByTitle("ทำซ้ำ", { exact: true }).click();
  expect((await state(page)).project.layers).toHaveLength(12);
  expect(errors).toEqual([]);
  await fs.writeFile(
    info.outputPath("stability.json"),
    JSON.stringify(
      {
        layers: 12,
        objects: 96,
        angleEdits: 12,
        modeCycles: 3,
        totalMs: Date.now() - begin,
        roundtrip,
      },
      null,
      2,
    ),
  );
});

test("v3 export menu, new dialog, selected text properties and rotation are readable", async ({
  page,
}, info) => {
  await boot(page);
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const t of ["light", "dark"]) {
      await theme(page, t);
      await page.getByRole("button", { name: "ส่งออก", exact: false }).click();
      expect(await contrastFailures(page)).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${size.width}-${t}-export.png`),
      });
      await page.getByRole("button", { name: "ส่งออก", exact: false }).click();
      await page.getByTitle("สร้างงานใหม่").click();
      expect(await contrastFailures(page)).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${size.width}-${t}-new.png`),
      });
      await page.getByRole("button", { name: "กลับไปดูงานในสตูดิโอ" }).click();
      await select(page, "text");
      if (size.width === 390)
        await page
          .getByRole("button", { name: "คุณสมบัติ", exact: true })
          .click();
      await expect(page.getByLabel("แก้ไขข้อความ")).toBeVisible();
      expect(await contrastFailures(page)).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${size.width}-${t}-text.png`),
      });
      if (size.width === 390)
        await page.getByRole("button", { name: "ปิดคุณสมบัติ" }).click();
      await page.getByLabel("หมุนวัตถุ", { exact: true }).click();
      expect(await contrastFailures(page)).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${size.width}-${t}-rotation.png`),
      });
      const input = page
        .getByRole("dialog", { name: "หมุนวัตถุ 360 องศา" })
        .getByLabel("มุมหมุน °", { exact: true });
      const before = await state(page);
      await input.fill("78");
      await input.press("Escape");
      expect((await state(page)).project).toEqual(before.project);
    }
  }
});
