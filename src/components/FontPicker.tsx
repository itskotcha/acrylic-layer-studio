import { useRef, useState } from "react";
import { BUILTIN_FONTS, readFont, ensureFonts, missingFonts } from "../fonts";
import { useStudio } from "../store";
import type { Project, Assets } from "../model";
export default function FontPicker({
  onError,
}: {
  onError: (s: string) => void;
}) {
  const [weight, setWeight] = useState("400"),
    [style, setStyle] = useState<"normal" | "italic">("normal");
  const s = useStudio(),
    [query, setQuery] = useState(""),
    input = useRef<HTMLInputElement>(null);
  const o = s.project.layers
    .find((l) => l.id === s.layerId)
    ?.objects.find((o) => o.id === s.objectId);
  const options = [
    ...BUILTIN_FONTS.map((f) => ({
      family: f.family,
      name: f.family,
      category: "ฟอนต์ในแอป · " + f.category,
    })),
    ...Object.values(s.project.fonts).map((f) => ({
      family: f.family,
      name: f.name,
      category: "ฟอนต์ของฉัน",
    })),
  ];
  return (
    <div className="font-picker">
      <label className="field">
        ฟอนต์
        <select
          aria-label="ฟอนต์"
          value={o?.fontFamily || "Noto Sans Thai"}
          onChange={async (e) => {
            const family = e.target.value,
              projectId = s.project.id,
              objectId = s.objectId;
            try {
              await ensureFonts({
                ...s.project,
                layers: [
                  {
                    ...s.project.layers[0],
                    objects: [{ ...o!, fontFamily: family }],
                  },
                ],
              });
              const current = useStudio.getState();
              if (
                current.project.id === projectId &&
                current.objectId === objectId
              )
                current.patchObject({ fontFamily: family });
            } catch (err) {
              onError(String(err));
            }
          }}
        >
          {options.map((f) => (
            <option key={f.family} value={f.family}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>ค้นหาและนำเข้าฟอนต์</summary>
        <label className="field">
          ค้นหาฟอนต์
          <input
            aria-label="ค้นหาฟอนต์"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="font-list">
          {options
            .filter((f) =>
              (f.name + f.category).toLowerCase().includes(query.toLowerCase()),
            )
            .map((f) => (
              <button
                key={f.family}
                className={o?.fontFamily === f.family ? "active" : ""}
                style={{ fontFamily: f.family }}
                onClick={async () => {
                  try {
                    await ensureFonts({
                      ...s.project,
                      layers: [
                        {
                          ...s.project.layers[0],
                          objects: [{ ...o!, fontFamily: f.family }],
                        },
                      ],
                    });
                    s.patchObject({ fontFamily: f.family });
                  } catch (e) {
                    onError(String(e));
                  }
                }}
              >
                {f.name}
                <small>{f.category} · ภาษาไทย Aa</small>
              </button>
            ))}
        </div>
        <small>
          ฟอนต์นำเข้าและฟอนต์ระบบอาจไม่มีอักษรไทย
          บางตัวอักษรจะแสดงด้วยฟอนต์สำรอง
        </small>
        <label className="field">
          น้ำหนักไฟล์ที่จะนำเข้า
          <select value={weight} onChange={(e) => setWeight(e.target.value)}>
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          รูปแบบไฟล์
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as any)}
          >
            <option value="normal">ปกติ</option>
            <option value="italic">ตัวเอียง</option>
          </select>
        </label>
        <button className="wide" onClick={() => input.current?.click()}>
          นำเข้าฟอนต์ของฉัน
        </button>
        <small>
          TTF · OTF · WOFF · WOFF2 ไม่เกิน 10 MB
          <br />
          โปรดใช้ฟอนต์ที่คุณมีสิทธิ์ใช้งานและฝังในไฟล์
        </small>
      </details>
      <input
        hidden
        ref={input}
        type="file"
        data-testid="font-input"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (Object.keys(s.project.fonts).length >= 30)
              throw Error("รองรับ 30 ฟอนต์ต่อโปรเจกต์");
            const projectId = s.project.id,
              layerId = s.layerId,
              objectId = s.objectId;
            const f = await readFont(file, undefined, { weight, style });
            if (useStudio.getState().project.id !== projectId) return;
            s.change((p) => {
              p.fonts[f.id] = f;
              const targetLayer = p.layers.find((l) => l.id === layerId);
              const obj = targetLayer?.objects.find((o) => o.id === objectId);
              if (obj && !obj.locked && !targetLayer?.locked)
                obj.fontFamily = f.family;
            });
          } catch (err) {
            onError(String(err));
          }
        }}
      />
    </div>
  );
}
export function MissingFonts({
  value,
  onCancel,
  onOpen,
  onError,
}: {
  value: { project: Project; assets: Assets };
  onCancel: () => void;
  onOpen: (p: Project, a: Assets) => void;
  onError: (s: string) => void;
}) {
  const [p, setP] = useState(value.project),
    [busy, setBusy] = useState(false),
    missing = missingFonts(p);
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="ฟอนต์ที่ขาด">
        <h2>โปรเจกต์นี้มีฟอนต์ที่ไม่ได้ฝัง</h2>
        <p>นำเข้าฟอนต์เดิม หรือเลือกแทนก่อนเปิดงาน งานปัจจุบันยังอยู่ครบ</p>
        {missing.map((f) => (
          <div className="missing-font" key={f.id}>
            <strong>{f.name}</strong>
            <label className="button">
              นำเข้าฟอนต์เดิม
              <input
                hidden
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const font = await readFont(file, f);
                    setP((p) => ({
                      ...p,
                      fonts: { ...p.fonts, [font.id]: font },
                    }));
                  } catch (err) {
                    onError(String(err));
                  }
                }}
              />
            </label>
            <select
              aria-label={"ฟอนต์แทน " + f.name}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                const next = structuredClone(p);
                next.layers.forEach((l) =>
                  l.objects.forEach((o) => {
                    if (o.fontFamily === f.family)
                      o.fontFamily = e.target.value;
                  }),
                );
                delete next.fonts[f.id];
                setP(next);
              }}
            >
              <option value="">เลือกฟอนต์แทน…</option>
              {BUILTIN_FONTS.map((b) => (
                <option key={b.family}>{b.family}</option>
              ))}
            </select>
          </div>
        ))}
        <div className="button-row">
          <button onClick={onCancel}>ยกเลิก</button>
          <button
            className="primary"
            disabled={!!missing.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await ensureFonts(p);
                onOpen(p, value.assets);
              } catch (e) {
                onError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            เปิดโปรเจกต์
          </button>
        </div>
      </div>
    </div>
  );
}
