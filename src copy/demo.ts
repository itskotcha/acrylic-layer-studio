import { normalizeStroke } from "./brushes";
import {
  blank,
  layer,
  baseObject,
  uid,
  distribute,
  scaleObject,
  type Assets,
} from "./model";
// Original geometric artwork. No external images or borrowed character assets.
export function makeDemo() {
  const p = blank(900, 1200);
  p.name = "ระหว่างแสงและทะเล";
  const assets: Assets = {};
  p.layers = [];
  const add = (name: string, draw: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    draw(c.getContext("2d")!);
    const id = uid();
    assets[id] = {
      id,
      name: name + ".png",
      mime: "image/png",
      width: 900,
      height: 1200,
      data: c.toDataURL(),
    };
    const l = layer(name);
    l.objects = [
      { ...baseObject("image"), width: 900, height: 1200, assetId: id },
    ];
    p.layers.push(l);
    return l;
  };
  add("01 · ท้องฟ้า", (c) => {
    const g = c.createLinearGradient(0, 0, 0, 1200);
    g.addColorStop(0, "#133e56");
    g.addColorStop(0.65, "#568e99");
    g.addColorStop(1, "#b9d9d5");
    c.fillStyle = g;
    c.fillRect(0, 0, 900, 1200);
    c.fillStyle = "#f9ca88";
    c.beginPath();
    c.arc(470, 415, 180, 0, Math.PI * 2);
    c.fill();
  });
  add("02 · เส้นขอบฟ้า", (c) => {
    c.fillStyle = "#dce9db";
    c.beginPath();
    c.moveTo(0, 650);
    c.bezierCurveTo(300, 500, 540, 890, 900, 570);
    c.lineTo(900, 1200);
    c.lineTo(0, 1200);
    c.fill();
    c.fillStyle = "#77b3b7";
    c.beginPath();
    c.moveTo(0, 840);
    c.bezierCurveTo(250, 570, 680, 990, 900, 760);
    c.lineTo(900, 1200);
    c.lineTo(0, 1200);
    c.fill();
  });
  const front = add("03 · ใกล้ฉัน", (c) => {
    c.fillStyle = "#1c596a";
    c.beginPath();
    c.moveTo(0, 960);
    c.bezierCurveTo(400, 800, 470, 1080, 900, 860);
    c.lineTo(900, 1200);
    c.lineTo(0, 1200);
    c.fill();
    c.strokeStyle = "#ffe0a7";
    c.lineWidth = 3;
    c.strokeRect(45, 45, 810, 1110);
  });
  front.objects.push({
    ...baseObject("text"),
    x: 95,
    y: 95,
    width: 710,
    height: 130,
    text: "STILL / HERE",
    fontSize: 76,
    fontFamily: "Noto Sans Thai",
    align: "left",
    fill: "#ffffff",
  });
  front.objects.push({
    ...baseObject("text"),
    x: 95,
    y: 205,
    width: 710,
    height: 100,
    text: "เก็บแสงไว้ในความทรงจำ",
    fontSize: 29,
    fontFamily: "Noto Sans Thai",
    align: "left",
    fill: "#ffffff",
  });
  front.objects.push({
    ...baseObject("stroke"),
    x: 100,
    y: 1080,
    width: 180,
    height: 20,
    points: [0, 0, 45, -10, 90, 0, 135, -10, 180, 0],
    fill: "#ffd49c",
    strokeWidth: 5,
  });
  distribute(p);
  const k = 100 / Math.max(p.width, p.height);
  p.layers.forEach((l) => {
    l.objects = l.objects.map((o) =>
      scaleObject(o.type === "stroke" ? normalizeStroke(o) : o, k),
    );
  });
  p.width *= k;
  p.height *= k;
  return { project: p, assets };
}

export function makeBrushDemo() {
  const p = blank(100, 120);
  p.name = "สีและเส้น · Brush collection";
  p.layers = [
    layer("01 · พื้นหลังไล่สี"),
    layer("02 · หัวปากกาหกแบบ"),
    layer("03 · ตัวอักษร"),
  ];
  p.layers[0].objects = [
    {
      ...baseObject("background"),
      width: p.width,
      height: p.height,
      fill: "#faf6ef",
      fill2: "#e0e7ff",
      backgroundMode: "gradient",
      gradientAngle: 65,
    },
  ];
  const kinds = [
    "round",
    "pencil",
    "marker",
    "highlighter",
    "airbrush",
    "flat",
  ] as const;
  const names = [
    "ROUND / เส้นเรียบ",
    "PENCIL / ดินสอ",
    "MARKER / หัวตัด",
    "HIGHLIGHTER / โปร่งแสง",
    "AIRBRUSH / ขอบฟุ้ง",
    "FLAT / พู่กันแบน",
  ];
  const colors = [
    "#635bda",
    "#475569",
    "#db7f70",
    "#d5a137",
    "#4c9a96",
    "#7b62a3",
  ];
  kinds.forEach((brushType, i) => {
    const y = 38 + i * 12;
    p.layers[1].objects.push(
      normalizeStroke({
        ...baseObject("stroke"),
        points: [
          37,
          y + 3,
          45,
          y - 1,
          54,
          y + 2,
          64,
          y - 1,
          74,
          y + 2,
          88,
          y - 1,
        ],
        width: 100,
        height: 120,
        fill: colors[i],
        strokeWidth: brushType === "highlighter" ? 4 : 2.2,
        brushType,
        brushVersion: 1,
        seed: 51 + i,
        erasures: [],
      }),
    );
    p.layers[2].objects.push({
      ...baseObject("text"),
      x: 10,
      y: y - 0.5,
      width: 26,
      height: 8,
      text: names[i],
      fontSize: 2.2,
      fontFamily: "Sarabun",
      align: "left",
      fill: "#54536a",
    });
  });
  p.layers[2].objects.push(
    {
      ...baseObject("text"),
      x: 10,
      y: 8,
      width: 85,
      height: 12,
      text: "Every line, a little story.",
      fontSize: 5,
      fontFamily: "Chonburi",
      align: "left",
      fill: "#383449",
    },
    {
      ...baseObject("text"),
      x: 10,
      y: 23,
      width: 80,
      height: 10,
      text: "ทดลองสีและเส้น ในมิติของคุณ",
      fontSize: 3.5,
      fontFamily: "Mali",
      align: "left",
      fill: "#635bda",
    },
    {
      ...baseObject("text"),
      x: 10,
      y: 109,
      width: 80,
      height: 8,
      text: "ACRYLIC LAYER STUDIO  /  COLLECTION 02",
      fontSize: 2,
      fontFamily: "Noto Sans Thai",
      align: "left",
      fill: "#777388",
    },
  );
  distribute(p);
  return { project: p, assets: {} as Assets };
}
