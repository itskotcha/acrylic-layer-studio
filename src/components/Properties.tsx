import { useEffect, useState } from "react";
import { useStudio, duplicateObject, deleteObject } from "../store";
import { constrainDepth, distribute, imageObject } from "../model";
export function NumberField({
  label,
  value,
  onChange,
  min = -10000,
  max = 10000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Math.round(value * 1000) / 1000)), [value]);
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = Number(draft);
          if (draft !== "" && Number.isFinite(v))
            onChange(Math.max(min, Math.min(max, v)));
          else setDraft(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
export default function Properties() {
  const {
    project: p,
    assets,
    layerId,
    objectId,
    change,
    patchObject,
    select,
  } = useStudio();
  const l = p.layers.find((l) => l.id === layerId);
  const o = l?.objects.find((o) => o.id === objectId);
  const [depthDraft, setDepthDraft] = useState(l?.depth ?? 0.5);
  useEffect(() => setDepthDraft(l?.depth ?? 0.5), [l?.id, l?.depth]);
  const commitDepth = () => {
    if (l) change((p) => constrainDepth(p, l.id, depthDraft));
  };
  return (
    <aside className="properties panel">
      <div className="panel-heading">
        คุณสมบัติ <span>{o ? "OBJECT" : "PROJECT"}</span>
      </div>
      <section>
        <h3>ก้อนอะคริลิก</h3>
        <div className="dimension">
          <strong>
            {p.width} × {p.height}
          </strong>
          <span>พิกเซล</span>
        </div>
        <NumberField
          label="ความหนา · หน่วยเสมือน"
          value={p.thickness}
          min={0.1}
          max={2}
          step={0.05}
          onChange={(v) =>
            change((p) => {
              p.thickness = v;
            })
          }
        />
        <small>ความสูงก้อน = 3 หน่วย · ไม่ใช่ขนาดผลิตจริง</small>
      </section>
      {l && (
        <section>
          <h3>ชั้นที่เลือก</h3>
          <label className="field">
            ชื่อชั้น
            <input
              aria-label="ชื่อชั้น"
              value={l.name}
              maxLength={200}
              onChange={(e) =>
                change((p) => {
                  p.layers.find((x) => x.id === l.id)!.name = e.target.value;
                })
              }
            />
          </label>
          <NumberField
            label="ความลึก · 0 หลัง / 1 หน้า"
            value={l.depth}
            min={0.04}
            max={0.96}
            step={0.01}
            onChange={(v) => change((p) => constrainDepth(p, l.id, v))}
          />
          <input
            aria-label="ความลึกเลเยอร์"
            type="range"
            min="0.04"
            max="0.96"
            step="0.01"
            value={depthDraft}
            onChange={(e) => setDepthDraft(+e.target.value)}
            onPointerUp={commitDepth}
            onKeyUp={commitDepth}
            onBlur={commitDepth}
          />
          <button className="wide" onClick={() => change(distribute)}>
            กระจายระยะเท่ากัน
          </button>
          <small>ระยะจำกัดตามชั้นข้างเคียง เพื่อไม่ให้ซ้อนชนกัน</small>
        </section>
      )}
      {o && l && (
        <section>
          <h3>
            {o.type === "text"
              ? "ข้อความ"
              : o.type === "image"
                ? "รูปภาพ"
                : "เส้นวาด"}{" "}
            {l.locked && "· ล็อกแล้ว"}
          </h3>
          <fieldset disabled={l.locked}>
            <div className="field-grid">
              <NumberField
                label="X"
                value={o.x}
                onChange={(v) => patchObject({ x: v })}
              />
              <NumberField
                label="Y"
                value={o.y}
                onChange={(v) => patchObject({ y: v })}
              />
              <NumberField
                label="กว้าง"
                value={o.width}
                min={4}
                max={10000}
                onChange={(v) =>
                  patchObject(
                    o.type === "stroke"
                      ? {
                          width: v,
                          points: o.points!.map((n, i) =>
                            i % 2 ? n : (n * v) / o.width,
                          ),
                        }
                      : {
                          width: v,
                          height: (o.height * v) / o.width,
                          ...(o.type === "text"
                            ? { fontSize: (o.fontSize! * v) / o.width }
                            : {}),
                        },
                  )
                }
              />
              <NumberField
                label="สูง"
                value={o.height}
                min={4}
                max={10000}
                onChange={(v) =>
                  patchObject(
                    o.type === "stroke"
                      ? {
                          height: v,
                          points: o.points!.map((n, i) =>
                            i % 2 ? (n * v) / o.height : n,
                          ),
                        }
                      : {
                          height: v,
                          width: (o.width * v) / o.height,
                          ...(o.type === "text"
                            ? { fontSize: (o.fontSize! * v) / o.height }
                            : {}),
                        },
                  )
                }
              />
              <NumberField
                label="หมุน °"
                value={o.rotation}
                min={-360}
                max={360}
                onChange={(v) => patchObject({ rotation: v })}
              />
              <NumberField
                label="ความทึบ"
                value={o.opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => patchObject({ opacity: v })}
              />
            </div>
            <div className="button-row">
              <button
                onClick={() => patchObject({ x: (p.width - o.width) / 2 })}
              >
                กึ่งกลาง X
              </button>
              <button
                onClick={() => patchObject({ y: (p.height - o.height) / 2 })}
              >
                กึ่งกลาง Y
              </button>
            </div>
            {o.type === "image" && (
              <div className="button-row">
                {[false, true].map((fill) => (
                  <button
                    key={String(fill)}
                    onClick={() => {
                      const sized = imageObject(assets[o.assetId!], p, fill);
                      const { id, ...rest } = sized;
                      patchObject(rest);
                    }}
                  >
                    {fill ? "Fill · เต็มพื้นที่" : "Fit · เห็นครบ"}
                  </button>
                ))}
              </div>
            )}
            {o.type === "text" && (
              <>
                <label className="field">
                  ข้อความ
                  <textarea
                    aria-label="แก้ไขข้อความ"
                    value={o.text}
                    maxLength={10000}
                    rows={3}
                    onChange={(e) => patchObject({ text: e.target.value })}
                  />
                </label>
                <label className="field">
                  ฟอนต์
                  <select
                    value={o.fontFamily}
                    onChange={(e) =>
                      patchObject({ fontFamily: e.target.value })
                    }
                  >
                    <option>Noto Sans Thai</option>
                    <option>sans-serif</option>
                    <option>serif</option>
                  </select>
                </label>
                <NumberField
                  label="ขนาดตัวอักษร"
                  value={o.fontSize!}
                  min={1}
                  max={1000}
                  onChange={(v) =>
                    patchObject({
                      fontSize: v,
                      height: Math.max(o.height, v * 1.5),
                    })
                  }
                />
                <label className="field">
                  จัดแนว
                  <select
                    value={o.align}
                    onChange={(e) =>
                      patchObject({ align: e.target.value as any })
                    }
                  >
                    <option value="left">ซ้าย</option>
                    <option value="center">กลาง</option>
                    <option value="right">ขวา</option>
                  </select>
                </label>
              </>
            )}
            {o.type !== "image" && (
              <label className="field">
                สี
                <input
                  type="color"
                  value={o.fill}
                  onChange={(e) => patchObject({ fill: e.target.value })}
                />
              </label>
            )}
            {o.type === "stroke" && (
              <NumberField
                label="ขนาดเส้น"
                value={o.strokeWidth!}
                min={1}
                max={200}
                onChange={(v) => patchObject({ strokeWidth: v })}
              />
            )}
            <label className="field">
              ย้ายไปชั้น
              <select
                value={l.id}
                onChange={(e) => {
                  const target = e.target.value;
                  change((p) => {
                    const from = p.layers.find((x) => x.id === l.id)!,
                      to = p.layers.find((x) => x.id === target)!;
                    if (to.locked) return;
                    from.objects = from.objects.filter((x) => x.id !== o.id);
                    to.objects.push(o);
                  });
                  select(target, o.id);
                }}
              >
                {p.layers
                  .filter((x) => !x.locked || x.id === l.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="button-row">
              <button
                onClick={() =>
                  change((p) => {
                    const a = p.layers.find((x) => x.id === l.id)!.objects;
                    const i = a.findIndex((x) => x.id === o.id);
                    if (i < a.length - 1) [a[i], a[i + 1]] = [a[i + 1], a[i]];
                  })
                }
              >
                วัตถุขึ้นหน้า
              </button>
              <button
                onClick={() =>
                  change((p) => {
                    const a = p.layers.find((x) => x.id === l.id)!.objects;
                    const i = a.findIndex((x) => x.id === o.id);
                    if (i > 0) [a[i], a[i - 1]] = [a[i - 1], a[i]];
                  })
                }
              >
                วัตถุไปหลัง
              </button>
            </div>
            <div className="button-row">
              <button onClick={duplicateObject}>ทำสำเนา</button>
              <button className="danger" onClick={deleteObject}>
                ลบวัตถุ
              </button>
            </div>
          </fieldset>
        </section>
      )}
      {!o && (
        <div className="tip">
          เลือกวัตถุบนภาพหรือในรายการ เพื่อปรับตำแหน่ง ขนาด และรายละเอียด
        </div>
      )}
    </aside>
  );
}
