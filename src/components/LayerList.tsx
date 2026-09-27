import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Plus,
} from "lucide-react";
import { useStudio } from "../store";
import { clone, distribute, uid, MAX_LAYERS, type DepthLayer } from "../model";
import { rasterLayer } from "../raster";
function Thumb({ l }: { l: DepthLayer }) {
  const { project, assets } = useStudio();
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      rasterLayer(project, l, assets, 100)
        .then((c) => {
          if (active) setUrl(c.toDataURL());
        })
        .catch(() => {});
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [JSON.stringify(l.objects), project.width, project.height]);
  return url ? <img src={url} alt="" /> : <div />;
}
export default function LayerList({
  onError,
}: {
  onError: (s: string) => void;
}) {
  const {
    project: p,
    layerId,
    objectId,
    select,
    change,
    addLayer,
  } = useStudio();
  function reorder(id: string, d: number) {
    change((p) => {
      const i = p.layers.findIndex((l) => l.id === id),
        j = i + d;
      if (j < 0 || j >= p.layers.length) return;
      [p.layers[i], p.layers[j]] = [p.layers[j], p.layers[i]];
      distribute(p);
    });
  }
  return (
    <div className="layers">
      <div className="panel-heading">
        เลเยอร์{" "}
        <button
          title="เพิ่มชั้นว่าง"
          onClick={() => {
            try {
              addLayer();
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          <Plus size={17} />
        </button>
      </div>
      <div className="layer-caption">
        ด้านหน้า ↑ <span>{p.layers.length} ชั้น</span>
      </div>
      {[...p.layers].reverse().map((l) => (
        <div
          key={l.id}
          className={"layer-card " + (l.id === layerId ? "selected" : "")}
        >
          <button className="layer-select" onClick={() => select(l.id)}>
            <div className="thumb">
              <Thumb l={l} />
            </div>
            <span>
              <strong>{l.name}</strong>
              <small>
                {l.objects.length} วัตถุ · {l.depth.toFixed(2)}
              </small>
            </span>
          </button>
          <div className="layer-actions">
            <button
              title={l.visible ? "ซ่อนชั้น" : "แสดงชั้น"}
              onClick={() =>
                change((p) => {
                  p.layers.find((x) => x.id === l.id)!.visible = !l.visible;
                })
              }
            >
              {l.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <button
              title={l.locked ? "ปลดล็อก" : "ล็อกชั้น"}
              onClick={() =>
                change((p) => {
                  p.layers.find((x) => x.id === l.id)!.locked = !l.locked;
                })
              }
            >
              {l.locked ? <Lock size={15} /> : <Unlock size={15} />}
            </button>
            <button title="เลื่อนชั้นขึ้นหน้า" onClick={() => reorder(l.id, 1)}>
              <ChevronUp size={15} />
            </button>
            <button title="เลื่อนชั้นไปหลัง" onClick={() => reorder(l.id, -1)}>
              <ChevronDown size={15} />
            </button>
            <button
              title="สำเนาชั้น"
              disabled={
                p.layers.length >= MAX_LAYERS ||
                p.layers.reduce((n, x) => n + x.objects.length, 0) +
                  l.objects.length >
                  500
              }
              onClick={() => {
                const n = clone(l);
                n.id = uid();
                n.name += " สำเนา";
                n.objects.forEach((o) => (o.id = uid()));
                change((p) => {
                  p.layers.splice(
                    p.layers.findIndex((x) => x.id === l.id) + 1,
                    0,
                    n,
                  );
                  distribute(p);
                });
                select(n.id);
              }}
            >
              <Copy size={15} />
            </button>
            <button
              title="ลบชั้น"
              disabled={p.layers.length === 1 || l.locked}
              onClick={() => {
                if (!confirm("ลบชั้นนี้และวัตถุในชั้น? ย้อนกลับได้ด้วย Undo"))
                  return;
                change((p) => {
                  p.layers = p.layers.filter((x) => x.id !== l.id);
                  distribute(p);
                });
                select(useStudio.getState().project.layers.at(-1)!.id);
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
          {l.id === layerId && (
            <div className="object-list">
              {[...l.objects].reverse().map((o, i) => (
                <button
                  className={objectId === o.id ? "active" : ""}
                  key={o.id}
                  onClick={() => select(l.id, o.id)}
                >
                  <span>
                    {o.type === "image" ? "▧" : o.type === "text" ? "T" : "〰"}
                  </span>
                  {o.type === "text"
                    ? o.text?.slice(0, 24)
                    : o.type === "image"
                      ? "รูปภาพ " + (l.objects.length - i)
                      : "เส้นวาด"}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="layer-caption">ด้านหลัง ↓</div>
    </div>
  );
}
