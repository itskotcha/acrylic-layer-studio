import { useState } from "react";
import { X, ImagePlus, Ratio } from "lucide-react";
import { blank, imageObject, type Project, type Assets } from "../model";
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
  const [w, setW] = useState(75),
    [h, setH] = useState(100),
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
        <h2>สร้างงานใหม่</h2>
        <p>เลือกสัดส่วนพื้นที่ออกแบบ</p>
        <div className="new-options">
          <div className="new-option">
            <ImagePlus />
            <h3>ตามภาพแรก</h3>
            <p>ใช้สัดส่วนภาพ ด้านยาว 100 หน่วย เก็บต้นฉบับเต็มความละเอียด</p>
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
                    const k = 100 / Math.max(a.width, a.height);
                    const p = blank(a.width * k, a.height * k);
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
                    setW((a * 100) / Math.max(a, b));
                    setH((b * 100) / Math.max(a, b));
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
                กว้าง (หน่วยออกแบบ)
                <input
                  aria-label="ความกว้างงาน"
                  type="number"
                  min={1}
                  max={10000}
                  value={w}
                  onChange={(e) => setW(+e.target.value)}
                />
              </label>
              <label className="field">
                สูง (หน่วยออกแบบ)
                <input
                  aria-label="ความสูงงาน"
                  type="number"
                  min={1}
                  max={10000}
                  value={h}
                  onChange={(e) => setH(+e.target.value)}
                />
              </label>
            </div>
            <button
              className="primary wide"
              disabled={
                busy ||
                ![w, h].every((n) => Number.isFinite(n) && n >= 1 && n <= 10000)
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
