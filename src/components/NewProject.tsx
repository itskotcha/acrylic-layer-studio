import { useState } from "react";
import { X, ImagePlus, Ratio } from "lucide-react";
import {
  blank,
  imageObject,
  MAX_SIZE,
  type Project,
  type Assets,
} from "../model";
import { readImage } from "../io";
export default function NewProject({
  onClose,
  onCreate,
  onError,
}: {
  onClose: () => void;
  onCreate: (p: Project, a: Assets) => void;
  onError: (s: string) => void;
}) {
  const [w, setW] = useState(900),
    [h, setH] = useState(1200),
    [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="สร้างงานใหม่"
      >
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X />
        </button>
        <span className="eyebrow">A NEW PERSPECTIVE</span>
        <h2>เริ่มจากขนาดที่ใช่</h2>
        <p>เลือกพื้นที่สำหรับภาพและเรื่องราวของคุณ</p>
        <div className="new-options">
          <div className="new-option">
            <ImagePlus />
            <h3>ตามภาพแรก</h3>
            <p>ใช้ขนาดและสัดส่วนของภาพที่นำเข้า</p>
            <label className="button primary">
              {busy ? "กำลังอ่านภาพ…" : "เลือกภาพแรก"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  try {
                    const a = await readImage(f);
                    if (
                      a.width < 64 ||
                      a.height < 64 ||
                      Math.max(a.width, a.height) > MAX_SIZE
                    )
                      throw new Error(
                        "ภาพแรกต้องมีแต่ละด้าน 64–4096 px เพื่อใช้ขนาดตรงกับภาพ",
                      );
                    const p = blank(a.width, a.height);
                    p.layers[0].name = "ภาพแรก";
                    p.layers[0].objects = [imageObject(a, p)];
                    onCreate(p, { [a.id]: a });
                  } catch (e) {
                    onError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </div>
          <div className="new-option">
            <Ratio />
            <h3>เลือกสัดส่วน</h3>
            <p>กำหนดพื้นที่ แล้วเติมภาพได้ตามต้องการ</p>
            <div className="ratios">
              {[
                [1, 1],
                [3, 4],
                [4, 3],
                [9, 16],
                [16, 9],
              ].map(([a, b]) => (
                <button
                  className={Math.abs(w / h - a / b) < 0.001 ? "active" : ""}
                  key={a + ":" + b}
                  onClick={() => {
                    setW(a * 100);
                    setH(b * 100);
                  }}
                >
                  <span
                    style={{
                      width: (22 * a) / Math.max(a, b),
                      height: (22 * b) / Math.max(a, b),
                    }}
                  />
                  {a}:{b}
                </button>
              ))}
            </div>
            <div className="field-grid">
              <label className="field">
                กว้าง (px)
                <input
                  aria-label="ความกว้างงาน"
                  type="number"
                  min={64}
                  max={4096}
                  value={w}
                  onChange={(e) => setW(+e.target.value)}
                />
              </label>
              <label className="field">
                สูง (px)
                <input
                  aria-label="ความสูงงาน"
                  type="number"
                  min={64}
                  max={4096}
                  value={h}
                  onChange={(e) => setH(+e.target.value)}
                />
              </label>
            </div>
            <button
              className="primary wide"
              disabled={
                busy ||
                ![w, h].every(
                  (n) => Number.isInteger(n) && n >= 64 && n <= 4096,
                )
              }
              onClick={() => onCreate(blank(w, h), {})}
            >
              สร้างพื้นที่ออกแบบ
            </button>
          </div>
        </div>
        <small>เพิ่มภาพอย่างน้อย 2 ภาพ เพื่อสร้างมิติของงานซ้อนชั้น</small>
        <button className="wide" style={{ marginTop: 15 }} onClick={onClose}>
          กลับไปดูงานในสตูดิโอ
        </button>
      </div>
    </div>
  );
}
