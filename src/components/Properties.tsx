import { useEffect, useState, useRef } from "react";
import { useStudio, duplicateObject, deleteObject } from "../store";
import { constrainDepth, distribute, imageObject, scaleObject } from "../model";
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
  const [dirty, setDirty] = useState(false);
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
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (!dirty) return;
          setDirty(false);
          const v = Number(draft);
          if (draft !== "" && Number.isFinite(v)) {
            const bounded = Math.max(min, Math.min(max, v));
            setDraft(String(bounded));
            onChange(bounded);
          } else setDraft(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
import RotationControl from "./RotationControl";
import { objectCenter } from "../geometry";
import FontPicker from "./FontPicker";
import Background from "./Background";
export default function Properties({
  onError,
  mode = "2d",
}: {
  onError: (s: string) => void;
  mode?: "2d" | "3d";
}) {
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
  const [tab, setTab] = useState<"object" | "layer" | "project">("object");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    setTab(mode === "3d" ? "layer" : o ? "object" : "layer");
    panel.current?.scrollTo(0, 0);
  }, [o?.id, l?.id, mode]);
  const [depthDraft, setDepthDraft] = useState(l?.depth ?? 0.5);
  useEffect(() => setDepthDraft(l?.depth ?? 0.5), [l?.id, l?.depth]);
  const commitDepth = () => {
    if (l) change((p) => constrainDepth(p, l.id, depthDraft));
  };
  return (
    <aside className="properties panel" ref={panel}>
      <div className="panel-heading">คุณสมบัติ</div>
      <div className="property-tabs" role="tablist" aria-label="รายละเอียด">
        <button
          role="tab"
          aria-selected={tab === "object"}
          onClick={() => setTab("object")}
        >
          วัตถุ
        </button>
        <button
          role="tab"
          aria-selected={tab === "layer"}
          onClick={() => setTab("layer")}
        >
          ชั้น
        </button>
        <button
          role="tab"
          aria-selected={tab === "project"}
          onClick={() => setTab("project")}
        >
          โปรเจกต์
        </button>
      </div>
      {tab === "project" && (
        <section>
          <h3>ก้อนอะคริลิก</h3>
          <Background onError={onError} />
          <div className="dimension">
            <strong>
              {+p.width.toFixed(2)} × {+p.height.toFixed(2)}
            </strong>
            <span>หน่วยออกแบบ · ไม่ใช่ px / mm</span>
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
          <details>
            <summary>เกี่ยวกับหน่วยออกแบบ</summary>
            <small>
              ขนาดนี้กำหนดสัดส่วน ไม่ใช่พิกเซลหรือมิลลิเมตร ความสูงก้อนในฉาก 3D
              เท่ากับ 3 หน่วยเสมือน เลือกความละเอียดภาพได้ตอนส่งออก
            </small>
          </details>
        </section>
      )}
      {tab === "layer" && l && (
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
            label="ตำแหน่งในก้อน"
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
          <div className="range-labels">
            <span>หลัง</span>
            <span>หน้า</span>
          </div>
          <button className="wide" onClick={() => change(distribute)}>
            จัดระยะชั้นเท่ากัน
          </button>
          <details>
            <summary>เกี่ยวกับตำแหน่งชั้น</summary>
            <small>
              เลื่อนตำแหน่งได้ระหว่างชั้นข้างเคียง หากต้องการสลับชั้น
              ให้ใช้ปุ่มเลื่อนชั้นในรายการ
            </small>
          </details>
        </section>
      )}
      {tab === "object" && o && l && (
        <section>
          <h3>
            {o.type === "text"
              ? "ข้อความ"
              : o.type === "image"
                ? "รูปภาพ"
                : "เส้นวาด"}{" "}
            {l.locked && "· ล็อกแล้ว"}
          </h3>
          <button
            className="wide"
            disabled={l.locked}
            onClick={() => patchObject({ locked: !o.locked })}
          >
            {o.locked ? "ปลดล็อกวัตถุ" : "ล็อกวัตถุ"}
          </button>
          <fieldset disabled={l.locked || o.locked}>
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
                <FontPicker onError={onError} />
                <NumberField
                  label="ขนาดตัวอักษร"
                  value={o.fontSize!}
                  min={0.01}
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
                    {fill ? "เต็มพื้นที่" : "เห็นภาพครบ"}
                  </button>
                ))}
              </div>
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
                min={0.01}
                max={200}
                onChange={(v) => patchObject({ strokeWidth: v })}
              />
            )}

            {o.type !== "background" && (
              <>
                <div className="field-grid">
                  <NumberField
                    label="กว้าง"
                    value={o.width}
                    min={0.01}
                    max={10000}
                    onChange={(v) =>
                      patchObject({
                        ...scaleObject(o, v / o.width),
                        x: o.x,
                        y: o.y,
                      })
                    }
                  />
                  <NumberField
                    label="สูง"
                    value={o.height}
                    min={0.01}
                    max={10000}
                    onChange={(v) =>
                      patchObject({
                        ...scaleObject(o, v / o.height),
                        x: o.x,
                        y: o.y,
                      })
                    }
                  />
                  <NumberField
                    label="ความทึบ %"
                    value={Math.round(o.opacity * 100)}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => patchObject({ opacity: v / 100 })}
                  />
                </div>
                <RotationControl />
                <details>
                  <summary>ตำแหน่งเพิ่มเติม</summary>
                  <div className="field-grid">
                    {" "}
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
                  </div>
                </details>
                <div className="button-row">
                  <button
                    onClick={() =>
                      patchObject({ x: o.x + p.width / 2 - objectCenter(o).x })
                    }
                  >
                    จัดกลางแนวนอน
                  </button>
                  <button
                    onClick={() =>
                      patchObject({ y: o.y + p.height / 2 - objectCenter(o).y })
                    }
                  >
                    จัดกลางแนวตั้ง
                  </button>
                </div>
              </>
            )}
            {o.type === "background" && (
              <>
                <label className="field">
                  รูปแบบพื้นหลัง
                  <select
                    value={o.backgroundMode}
                    onChange={(e) =>
                      patchObject({ backgroundMode: e.target.value as any })
                    }
                  >
                    <option value="solid">สีเดียว</option>
                    <option value="gradient">ไล่สี</option>
                    <option value="transparent">โปร่งใส</option>
                  </select>
                </label>
                <NumberField
                  label="ความทึบพื้นหลัง %"
                  value={Math.round(o.opacity * 100)}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => patchObject({ opacity: v / 100 })}
                />
                {o.backgroundMode === "gradient" && (
                  <>
                    <label className="field">
                      สีที่สอง
                      <input
                        type="color"
                        value={o.fill2}
                        onChange={(e) => patchObject({ fill2: e.target.value })}
                      />
                    </label>
                    <NumberField
                      label="ทิศทางไล่สี °"
                      value={o.gradientAngle || 0}
                      min={0}
                      max={360}
                      onChange={(v) => patchObject({ gradientAngle: v })}
                    />
                  </>
                )}
              </>
            )}
            {o.type === "background" && (
              <>
                <label className="field">
                  สี HEX
                  <input
                    key={o.fill}
                    defaultValue={o.fill}
                    onBlur={(e) => {
                      if (/^#[a-f0-9]{6}$/i.test(e.target.value))
                        patchObject({ fill: e.target.value });
                      else onError("ใช้สี HEX เช่น #ffffff");
                    }}
                  />
                </label>
                <div className="palette">
                  {[
                    "#ffffff",
                    "#000000",
                    "#e0e7ff",
                    "#fecdd3",
                    "#fef3c7",
                    "#d1fae5",
                  ].map((c) => (
                    <button
                      key={c}
                      aria-label={c}
                      style={{ background: c }}
                      onClick={() => patchObject({ fill: c })}
                    />
                  ))}
                </div>
              </>
            )}
            {o.type !== "background" && (
              <>
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
                        from.objects = from.objects.filter(
                          (x) => x.id !== o.id,
                        );
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
                        if (i < a.length - 1)
                          [a[i], a[i + 1]] = [a[i + 1], a[i]];
                      })
                    }
                  >
                    เลื่อนไปด้านหน้า
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
                    เลื่อนไปด้านหลัง
                  </button>
                </div>
                <div className="button-row">
                  <button onClick={duplicateObject}>ทำซ้ำ</button>
                  <button className="danger" onClick={deleteObject}>
                    ลบวัตถุ
                  </button>
                </div>
              </>
            )}
            {o.type === "background" && (
              <button className="danger wide" onClick={deleteObject}>
                ลบพื้นหลัง
              </button>
            )}
          </fieldset>
        </section>
      )}
      {tab === "object" && !o && (
        <div className="tip">
          เลือกวัตถุบนภาพหรือในรายการ เพื่อปรับตำแหน่ง ขนาด และรายละเอียด
        </div>
      )}
    </aside>
  );
}
