import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("editor, project roundtrip, autosave, exports, WebGL and mobile", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "กลับไปดูงานในสตูดิโอ" }).click();
  await expect(page.getByLabel("ชื่อโปรเจกต์")).toHaveValue(
    "ระหว่างแสงและทะเล",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath("editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "ข้อความ", exact: true }).click();
  await page.getByLabel("แก้ไขข้อความ").fill("ทดสอบภาษาไทย");
  await page.getByLabel("ชื่อโปรเจกต์").fill("QA project");
  const saved = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "บันทึกโปรเจกต์", exact: true })
    .click();
  const d = await saved;
  const path = info.outputPath("roundtrip.acrylic.zip");
  await d.saveAs(path);
  expect((await fs.stat(path)).size).toBeGreaterThan(1000);
  await page.getByLabel("แก้ไขข้อความ").fill("changed");
  await page.getByTestId("project-input").setInputFiles(path);
  await expect(
    page.getByRole("button", { name: "ทดสอบภาษาไทย", exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("บันทึกในเครื่องแล้ว", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("ชื่อโปรเจกต์")).toHaveValue("QA project");
  await page.getByRole("button", { name: "ส่งออก", exact: false }).click();
  const png = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PNG · ภาพด้านหน้า", exact: true })
    .click();
  await (await png).saveAs(info.outputPath("flat.png"));
  await page.getByRole("button", { name: "พรีวิว 3D", exact: true }).click();
  await expect(page.getByTestId("preview").locator("canvas")).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: info.outputPath("preview.png") });
  await page.getByRole("button", { name: "แยกชั้น", exact: true }).click();
  await page.screenshot({ path: info.outputPath("exploded.png") });
  await page.getByRole("button", { name: "ประกอบกลับ", exact: true }).click();
  const output = page.waitForEvent("download");
  await page.getByRole("button", { name: "บันทึกภาพ 3D", exact: true }).click();
  await (await output).saveAs(info.outputPath("3d.png"));
  await page
    .getByRole("button", { name: "มุมหน้า / รีเซ็ต", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath("front.png") });
  const canvas = page.getByTestId("preview").locator("canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.5, {
    steps: 30,
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath("rotated.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "ออกแบบ 2D", exact: true }).click();
  await page.screenshot({ path: info.outputPath("mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "เครื่องมือ / ชั้น" }).click();
  await expect(
    page.getByRole("button", { name: "เพิ่มรูปภาพ", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("new project ratio, import first image, drawing history and three PNGs", async ({
  page,
}, info) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "กลับไปดูงานในสตูดิโอ" }).click();
  await expect(page.getByLabel("ชื่อโปรเจกต์")).toBeVisible();
  await page.getByTitle("สร้างงานใหม่").click();
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await page
    .getByRole("button", { name: "สร้างพื้นที่ออกแบบ", exact: true })
    .click();
  await expect(page.getByText("100 × 100", { exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 800;
    const x = c.getContext("2d")!;
    x.fillStyle = "#ff4455";
    x.fillRect(150, 150, 250, 350);
    return c.toDataURL().split(",")[1];
  });
  const path = info.outputPath("transparent.png");
  await fs.writeFile(path, Buffer.from(png, "base64"));
  await page.getByTitle("สร้างงานใหม่").click();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles(path);
  await expect(page.getByText("75 × 100", { exact: true })).toBeVisible();
  await page.getByTestId("image-input").setInputFiles([path, path]);
  await expect(page.locator(".layer-card")).toHaveCount(3);
  await page.getByRole("button", { name: "ปากกา", exact: true }).click();
  const rect = (await page.getByTestId("editor").boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.45, rect.y + rect.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height * 0.5, {
    steps: 20,
  });
  await page.mouse.up();
  await expect(
    page
      .locator(".object-list")
      .getByRole("button", { name: "เส้นวาด", exact: false }),
  ).toHaveCount(1);
  await page.getByTitle("ย้อนกลับ").click();
  await expect(
    page
      .locator(".object-list")
      .getByRole("button", { name: "เส้นวาด", exact: false }),
  ).toHaveCount(0);
  await page.getByTitle("ทำซ้ำ").click();
  await expect(
    page
      .locator(".object-list")
      .getByRole("button", { name: "เส้นวาด", exact: false }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "ส่งออก", exact: false }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "ZIP · ภาพแยกทุกชั้น" }).click();
  await (await dl).saveAs(info.outputPath("layers.zip"));
});
test("layer visibility, locking, duplication, ordering and invalid project protection", async ({
  page,
}, info) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "กลับไปดูงานในสตูดิโอ" }).click();
  const count = page.locator(".layer-card");
  await expect(count).toHaveCount(3);
  await page.getByTitle("สำเนาชั้น").first().click();
  await expect(count).toHaveCount(4);
  await page.getByTitle("ซ่อนชั้น").first().click();
  await expect(page.getByTitle("แสดงชั้น")).toHaveCount(1);
  await page.getByTitle("แสดงชั้น").click();
  await page.getByTitle("ล็อกชั้น").first().click();
  await expect(page.getByTitle("ปลดล็อก")).toHaveCount(1);
  await page.getByRole("button", { name: "ข้อความ", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("ไม่ได้ล็อก");
  await page.getByTitle("ปลดล็อก").click();
  await page.getByTitle("เลื่อนชั้นไปหลัง").first().click();
  await page.getByTitle("ย้อนกลับ").click();
  await expect(count.first()).toContainText("สำเนา");
  const input = page.getByLabel("ความหนา · หน่วยเสมือน", { exact: true });
  await input.fill("0.1");
  await input.press("Enter");
  await expect(input).toHaveValue("0.1");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file(
    "project.json",
    JSON.stringify({ project: { schemaVersion: 99 }, assets: {} }),
  );
  const bad = info.outputPath("bad.zip");
  await fs.writeFile(bad, await zip.generateAsync({ type: "nodebuffer" }));
  await page.getByTestId("project-input").setInputFiles(bad);
  await expect(page.getByRole("status")).toContainText("ไม่ถูกต้อง");
  await expect(count).toHaveCount(4);
});
