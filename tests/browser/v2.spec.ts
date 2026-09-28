import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import JSZip from "jszip";
async function boot(page: any) {
  page.on("console", (m: any) => {
    if (
      m.type() === "error" &&
      /TypeError|Text components are not supported/.test(m.text())
    )
      throw Error(m.text());
  });
  page.on("dialog", (d: any) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "กลับไปดูงานในสตูดิโอ" }).click();
  await expect(page.getByTestId("editor").locator("canvas")).toBeVisible();
}
async function snapshot(page: any) {
  return page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    return structuredClone(useStudio.getState().project);
  });
}
async function square(page: any) {
  await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { blank } = await import("/src/model.ts");
    useStudio.getState().replace(blank(100, 100), {});
  });
}
function pngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
test("v2 backgrounds, 4K resolution, same pixels across UI themes and layer export", async ({
  page,
}, info) => {
  await boot(page);
  await square(page);
  await page
    .getByRole("button", { name: "เพิ่มแผ่นพื้นหลัง", exact: true })
    .click();
  await page.getByLabel("รูปแบบพื้นหลัง").selectOption("gradient");
  await page.getByLabel("ทิศทางไล่สี °").fill("35");
  await page.getByLabel("ทิศทางไล่สี °").press("Enter");
  await page.getByLabel("สี HEX", { exact: true }).fill("#b0c4ff");
  await page.getByLabel("สี HEX", { exact: true }).press("Tab");
  await page
    .getByRole("button", { name: "แก้ไขแผ่นพื้นหลัง", exact: true })
    .click();
  expect((await snapshot(page)).layers[0].objects).toHaveLength(1);
  const a = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState();
    return (await flatCanvas(s.project, s.assets, 1024)).toDataURL();
  });
  await page.getByLabel("ธีม", { exact: true }).selectOption("dark");
  const b = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState();
    return (await flatCanvas(s.project, s.assets, 1024)).toDataURL();
  });
  expect(b).toBe(a);
  await page.getByRole("button", { name: "ส่งออก", exact: false }).click();
  await page.getByLabel("ความละเอียดส่งออก").selectOption("4096");
  await expect(page.getByText("4096 × 4096 px · ภาพ 2D")).toBeVisible();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG · ภาพด้านหน้า" }).click();
  const out = info.outputPath("square-4k.png");
  await (await d).saveAs(out);
  expect(pngSize(await fs.readFile(out))).toEqual({
    width: 4096,
    height: 4096,
  });
  await page.getByRole("button", { name: "ส่งออก", exact: false }).click();
  await page.getByLabel("ความละเอียดส่งออก").selectOption("1024");
  const z = page.waitForEvent("download");
  await page.getByRole("button", { name: "ZIP · ภาพแยกทุกชั้น" }).click();
  const zp = info.outputPath("layers.zip");
  await (await z).saveAs(zp);
  const zip = await JSZip.loadAsync(await fs.readFile(zp));
  for (const file of Object.values(zip.files))
    if (file.name.endsWith(".png"))
      expect(pngSize(await file.async("nodebuffer"))).toEqual({
        width: 1024,
        height: 1024,
      });
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath("dark-background.png") });
  await page.reload();
  await expect(page.getByLabel("ธีม", { exact: true })).toHaveValue("dark");
  await page.getByLabel("ธีม", { exact: true }).selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("six real brush renders, partial eraser preserves image, transform masks and save roundtrip", async ({
  page,
}, info) => {
  await boot(page);
  await square(page);
  await page.getByRole("button", { name: "ปากกา", exact: true }).click();
  const box = (await page.getByTestId("editor").boundingBox())!;
  for (const [i, type] of [
    "round",
    "pencil",
    "marker",
    "highlighter",
    "airbrush",
    "flat",
  ].entries()) {
    await page.getByLabel("หัวปากกา").selectOption(type);
    await page.mouse.move(
      box.x + box.width * 0.3,
      box.y + box.height * 0.26 + i * 36,
    );
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.65,
      box.y + box.height * 0.3 + i * 36,
      { steps: 15 },
    );
    await page.mouse.up();
  }
  const p = await snapshot(page);
  expect(p.layers[0].objects.map((o: any) => o.brushType)).toEqual([
    "round",
    "pencil",
    "marker",
    "highlighter",
    "airbrush",
    "flat",
  ]);
  const result = await page.evaluate(async () => {
    const { strokeCanvas } = await import("/src/brushes.ts");
    const { useStudio } = await import("/src/store.ts");
    const objs = useStudio.getState().project.layers[0].objects;
    return objs.map((o) => {
      const c = strokeCanvas(o, 10),
        d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let alpha = 0,
        solid = 0;
      for (let i = 3; i < d.length; i += 4) {
        alpha += d[i];
        if (d[i] === 255) solid++;
      }
      return {
        alpha,
        solid,
        url: c.toDataURL(),
        again: strokeCanvas(structuredClone(o), 10).toDataURL(),
      };
    });
  });
  expect(new Set(result.map((r: any) => r.url)).size).toBe(6);
  for (const r of result) {
    expect(r.alpha).toBeGreaterThan(0);
    expect(r.url).toBe(r.again);
  }
  expect(result[3].solid).toBe(0);
  const protectedObjects = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { baseObject, uid } = await import("/src/model.ts");
    const c = document.createElement("canvas");
    c.width = c.height = 100;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f9b5ce";
    ctx.fillRect(20, 20, 60, 60);
    const id = uid(),
      state = useStudio.getState();
    state.addAssets({
      [id]: {
        id,
        name: "protected.png",
        mime: "image/png",
        width: 100,
        height: 100,
        data: c.toDataURL(),
      },
    });
    const image = {
        ...baseObject("image"),
        assetId: id,
        x: 42,
        y: 30,
        width: 15,
        height: 15,
      },
      text = {
        ...baseObject("text"),
        x: 41,
        y: 47,
        width: 25,
        height: 8,
        text: "ภาพและข้อความ",
        fill: "#333333",
        fontFamily: "Noto Sans Thai",
        fontSize: 2,
        align: "left",
      };
    state.change((p) => p.layers[0].objects.unshift(image, text));
    return [image, text];
  });
  await page.getByRole("button", { name: "ลบเส้น", exact: true }).click();
  await page.getByLabel("วิธีลบ").selectOption("partial");
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.62, {
    steps: 40,
  });
  await page.mouse.up();
  const erased = await snapshot(page);
  expect(
    erased.layers[0].objects.filter((o: any) => o.type !== "stroke"),
  ).toEqual(protectedObjects);
  expect(
    erased.layers[0].objects.filter((o: any) => o.erasures?.length).length,
  ).toBeGreaterThan(1);
  await page.getByTitle("ย้อนกลับ", { exact: true }).click();
  expect(
    (await snapshot(page)).layers[0].objects.every(
      (o: any) => !o.erasures?.length,
    ),
  ).toBe(true);
  await page.getByTitle("ทำซ้ำ", { exact: true }).click();
  const roundtrip = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const { packProject, unpackProject } = await import("/src/io.ts");
    const s = useStudio.getState(),
      before = (await flatCanvas(s.project, s.assets, 1024)).toDataURL(),
      loaded = await unpackProject(await packProject(s.project, s.assets));
    return {
      before,
      after: (
        await flatCanvas(loaded.project, loaded.assets, 1024)
      ).toDataURL(),
    };
  });
  expect(roundtrip.after).toBe(roundtrip.before);
  await page.getByLabel("ธีม", { exact: true }).selectOption("light");
  await page.screenshot({ path: info.outputPath("brushes-light.png") });
  await page.getByLabel("ธีม", { exact: true }).selectOption("dark");
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath("brushes-dark.png") });
});
test("paste, drop, lock menu, duplication and mobile touch delete without deleting layer", async ({
  page,
}, info) => {
  await boot(page);
  await square(page);
  const paste = () =>
    page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 800;
      const x = c.getContext("2d")!;
      x.fillStyle = "#fb4c70";
      x.fillRect(100, 100, 300, 500);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!)));
      const d = new DataTransfer();
      d.items.add(new File([blob], "paste.png", { type: "image/png" }));
      document.body.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: d,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  await paste();
  await expect(page.getByTestId("object-toolbar")).toBeVisible();
  const first = await snapshot(page);
  expect(first.layers[0].objects[0].type).toBe("image");
  await page
    .getByTestId("object-toolbar")
    .getByLabel("ล็อกวัตถุ", { exact: true })
    .click();
  expect((await snapshot(page)).layers[0].objects[0].locked).toBe(true);
  await expect(page.getByLabel("ลบวัตถุที่เลือก")).toBeDisabled();
  await page
    .getByTestId("object-toolbar")
    .getByLabel("ปลดล็อกวัตถุ", { exact: true })
    .click();
  await page.getByLabel("ทำสำเนาวัตถุ", { exact: true }).click();
  expect((await snapshot(page)).layers[0].objects).toHaveLength(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("mobile-object-menu.png") });
  const b = (await page.getByTestId("object-toolbar").boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  await page.getByLabel("ลบวัตถุที่เลือก").click();
  expect((await snapshot(page)).layers[0].objects).toHaveLength(1);
  expect((await snapshot(page)).layers).toHaveLength(1);
  await page.getByLabel("ย้อนกลับบนผืนงาน").click();
  expect((await snapshot(page)).layers[0].objects).toHaveLength(2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "ข้อความ", exact: true }).click();
  const before = (await snapshot(page)).layers.flatMap(
    (l: any) => l.objects,
  ).length;
  await page.getByLabel("แก้ไขข้อความ").evaluate((el) => {
    const d = new DataTransfer();
    d.setData("text/plain", "ทดสอบวางข้อความ");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: d,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(
    (await snapshot(page)).layers.flatMap((l: any) => l.objects),
  ).toHaveLength(before);
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 100;
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!)));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "drop.png", { type: "image/png" }));
    document.querySelector(".canvas-area")!.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator(".layer-card")).toHaveCount(2);
});
test("custom font embedded, autosave, missing font resolution and corrupt font rejection", async ({
  page,
}, info) => {
  await boot(page);
  await square(page);
  await page.getByRole("button", { name: "ข้อความ", exact: true }).click();
  await page
    .getByTestId("font-input")
    .setInputFiles(
      "node_modules/@fontsource/mali/files/mali-thai-400-normal.woff2",
    );
  await expect(page.locator(".font-list button.active")).toContainText(
    "mali-thai",
  );
  const custom = (await snapshot(page)).layers[0].objects[0].fontFamily;
  expect(custom).toMatch(/^custom-/);
  await expect(
    page.getByText("บันทึกในเครื่องแล้ว", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("ชื่อโปรเจกต์")).toBeVisible();
  expect((await snapshot(page)).fonts).not.toEqual({});
  const values = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { packProject, unpackProject } = await import("/src/io.ts");
    const { missingFonts } = await import("/src/fonts.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState();
    const embedded = await unpackProject(
        await packProject(s.project, s.assets, true),
      ),
      without = await unpackProject(
        await packProject(s.project, s.assets, false),
      );
    return {
      embedded: missingFonts(embedded.project).length,
      missing: missingFonts(without.project).length,
      same:
        (await flatCanvas(s.project, s.assets, 1024)).toDataURL() ===
        (await flatCanvas(embedded.project, embedded.assets, 1024)).toDataURL(),
      zip: Array.from(
        new Uint8Array(
          await (await packProject(s.project, s.assets, false)).arrayBuffer(),
        ),
      ),
    };
  });
  expect(values.embedded).toBe(0);
  expect(values.missing).toBe(1);
  expect(values.same).toBe(true);
  const path = info.outputPath("no-font.zip");
  await fs.writeFile(path, Buffer.from(values.zip));
  await page.getByTestId("project-input").setInputFiles(path);
  await expect(page.getByRole("dialog", { name: "ฟอนต์ที่ขาด" })).toBeVisible();
  expect((await snapshot(page)).layers[0].objects[0].fontFamily).toBe(custom);
  await page
    .getByLabel("ฟอนต์แทน mali-thai-400-normal.woff2")
    .selectOption("Mali");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "เปิดโปรเจกต์", exact: true })
    .click();
  expect((await snapshot(page)).layers[0].objects[0].fontFamily).toBe("Mali");
  await page.locator(".object-list button").first().click();
  await page.getByTestId("font-input").setInputFiles({
    name: "broken.woff2",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("invalid font"),
  });
  await expect(page.getByRole("status")).toBeVisible();
  expect((await snapshot(page)).fonts).toEqual({});
});
test("legacy project migrates assets intact and 3D render exports selected 2K with visible image", async ({
  page,
}, info) => {
  await boot(page);
  await page
    .getByTestId("project-input")
    .setInputFiles("examples/legacy-v1.acrylic.zip");
  await expect(page.getByText("75 × 100", { exact: true })).toBeVisible();
  const p = await snapshot(page);
  expect(p.schemaVersion).toBe(2);
  expect(p.layers).toHaveLength(3);
  await page.getByRole("button", { name: "พรีวิว 3D", exact: true }).click();
  await expect(page.getByTestId("preview").locator("canvas")).toBeVisible();
  await page.waitForTimeout(1800);
  await page
    .getByTestId("preview")
    .locator("canvas")
    .screenshot({ path: info.outputPath("before-export.png") });
  const cameraState = () =>
    page.evaluate(async () => {
      const { _roots } =
        await import("/node_modules/.vite/deps/@react-three_fiber.js");
      const s = _roots
        .get(document.querySelector("[data-testid=preview] canvas"))!
        .store.getState();
      return {
        position: s.camera.position.toArray(),
        quaternion: s.camera.quaternion.toArray(),
        zoom: s.camera.zoom,
        width: s.gl.domElement.width,
        height: s.gl.domElement.height,
        pixelRatio: s.gl.getPixelRatio(),
      };
    });
  const before = await cameraState();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "บันทึกภาพ 3D", exact: true }).click();
  const path = info.outputPath("3d-2k.png");
  await (await download).saveAs(path);
  const size = pngSize(await fs.readFile(path));
  expect(Math.max(size.width, size.height)).toBe(2048);
  await page
    .getByTestId("preview")
    .locator("canvas")
    .screenshot({ path: info.outputPath("v2-preview.png") });
  expect(pngSize(await fs.readFile(info.outputPath("v2-preview.png")))).toEqual(
    pngSize(await fs.readFile(info.outputPath("before-export.png"))),
  );
  expect(await cameraState()).toEqual(before);
  const meaningful = await page.evaluate(
    async (data) => {
      const i = new Image();
      i.src = "data:image/png;base64," + data;
      await i.decode();
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 100;
      const x = c.getContext("2d")!;
      x.drawImage(i, 0, 0, 100, 100);
      const d = x.getImageData(0, 0, 100, 100).data;
      let n = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] < 170 && d[k + 3] > 0) n++;
      return n;
    },
    (await fs.readFile(path)).toString("base64"),
  );
  expect(meaningful).toBeGreaterThan(100);
});
test("touch gestures cancel drawing, hand pan preserves artwork and snapping stays in screen pixels", async ({
  page,
}, info) => {
  await boot(page);
  await square(page);
  await page.getByRole("button", { name: "ปากกา", exact: true }).click();
  await page.evaluate(() => {
    const canvas = document.querySelector("[data-testid=editor] canvas")!,
      b = canvas.getBoundingClientRect();
    const send = (type: string, id: number, x: number, y: number) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          isPrimary: id === 10,
          bubbles: true,
          clientX: b.x + x,
          clientY: b.y + y,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    send("pointerdown", 10, 300, 300);
    send("pointermove", 10, 320, 320);
    send("pointerdown", 11, 400, 400);
    send("pointermove", 11, 460, 460);
    send("pointerup", 11, 460, 460);
    send("pointerup", 10, 320, 320);
  });
  expect((await snapshot(page)).layers[0].objects).toHaveLength(0);
  await page.getByTitle("พอดีหน้าจอ").click();
  await page.getByRole("button", { name: "เลื่อนพื้นที่ · Space" }).click();
  const b = (await page.getByTestId("editor").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5 + 70, b.y + b.height * 0.5 + 60, {
    steps: 10,
  });
  await page.mouse.up();
  expect((await snapshot(page)).layers[0].objects).toHaveLength(0);
  await page.getByTitle("พอดีหน้าจอ").click();
  await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { baseObject } = await import("/src/model.ts");
    const s = useStudio.getState(),
      o = {
        ...baseObject("text"),
        x: 20,
        y: 20,
        width: 20,
        height: 10,
        text: "SNAP",
        fontFamily: "Noto Sans Thai",
        fontSize: 5,
        fill: "#333333",
        align: "left",
      };
    s.change((p) => p.layers[0].objects.push(o));
    s.select(s.project.layers[0].id, o.id);
  });
  await page.getByRole("button", { name: "เลือก", exact: true }).click();
  for (const zoom of [1, 2]) {
    await page.getByTitle("พอดีหน้าจอ").click();
    if (zoom === 2) {
      await page.getByLabel("ซูมเข้า", { exact: true }).click();
      await page.getByLabel("ซูมเข้า", { exact: true }).click();
    }
    await page.evaluate(async () => {
      const { useStudio } = await import("/src/store.ts");
      const s = useStudio.getState();
      s.select(s.project.layers[0].id, s.project.layers[0].objects[0].id);
      s.patchObject({ x: 20, y: 20 });
    });
    const board = (await page.locator(".artboard").boundingBox())!,
      scale = board.width / 100;
    await page.mouse.move(board.x + 24 * scale, board.y + 23 * scale);
    await page.mouse.down();
    await page.mouse.move(board.x + 44 * scale + 2, board.y + 23 * scale, {
      steps: 12,
    });
    await page.mouse.up();
    expect((await snapshot(page)).layers[0].objects[0].x).toBeCloseTo(40, 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTitle("พอดีหน้าจอ").click();
  await page.getByRole("button", { name: "เครื่องมือ / ชั้น" }).click();
  await page.getByLabel("ธีม", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "ปิดเครื่องมือ" }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath("mobile-dark.png") });
});
test("mobile clipboard button handles mocked image data and denied permissions", async ({
  page,
}) => {
  await boot(page);
  await square(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "เครื่องมือ / ชั้น" }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        read: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "วางจากคลิปบอร์ด", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("วางรูปไม่ได้");
  expect((await snapshot(page)).layers[0].objects).toHaveLength(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        read: async () => {
          const c = document.createElement("canvas");
          c.width = c.height = 300;
          c.getContext("2d")!.fillRect(0, 0, 100, 100);
          const b = await new Promise<Blob>((r) => c.toBlob((b) => r(b!)));
          return [{ types: ["image/png"], getType: async () => b }];
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "วางจากคลิปบอร์ด", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("นำเข้ารูปเรียบร้อย");
  expect((await snapshot(page)).layers[0].objects).toHaveLength(1);
});
test("example gallery and embedded Thai font load in a fresh browser context", async ({
  page,
  browser,
}, info) => {
  await boot(page);
  await page
    .getByRole("button", { name: "ตัวอย่างหัวปากกาและพื้นหลัง", exact: true })
    .click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath("gallery-light.png") });
  const save = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "บันทึกโปรเจกต์", exact: true })
    .click();
  const fixture = info.outputPath("brush-gallery-v2.acrylic.zip");
  await (await save).saveAs(fixture);
  const pixel = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { blank } = await import("/src/model.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const p = blank(100, 100);
    const c = await flatCanvas(p, {}, 2048);
    return {
      w: c.width,
      h: c.height,
      alpha: c.getContext("2d")!.getImageData(100, 100, 1, 1).data[3],
    };
  });
  expect(pixel).toEqual({ w: 2048, h: 2048, alpha: 0 });
  await page.getByRole("button", { name: "ข้อความ", exact: true }).click();
  await page.getByLabel("แก้ไขข้อความ").fill("ทดสอบฟอนต์ไทย ABC");
  await page
    .getByTestId("font-input")
    .setInputFiles(
      "node_modules/@fontsource/mali/files/mali-thai-400-normal.woff2",
    );
  await expect(page.locator(".font-list button.active")).toContainText(
    "mali-thai",
  );
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "บันทึกโปรเจกต์", exact: true })
    .click();
  const embedded = info.outputPath("embedded-font.acrylic.zip");
  await (await dl).saveAs(embedded);
  const before = await page.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState();
    return (await flatCanvas(s.project, s.assets, 1024)).toDataURL();
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    next = await context.newPage();
  await boot(next);
  await next.getByTestId("project-input").setInputFiles(embedded);
  await expect(next.getByLabel("ชื่อโปรเจกต์")).toHaveValue(
    "สีและเส้น · Brush collection",
  );
  const after = await next.evaluate(async () => {
    const { useStudio } = await import("/src/store.ts");
    const { flatCanvas } = await import("/src/raster.ts");
    const s = useStudio.getState();
    return (await flatCanvas(s.project, s.assets, 1024)).toDataURL();
  });
  expect(after === before).toBe(true);
  await context.close();
});
