import { useStudio } from "../store";
import { baseObject, MAX_OBJECTS } from "../model";
export default function Background({
  onError,
}: {
  onError: (s: string) => void;
}) {
  const s = useStudio(),
    p = s.project;
  const owner = p.layers.find((l) =>
    l.objects.some((o) => o.type === "background"),
  );
  const bg = owner?.objects.find((o) => o.type === "background");
  function add() {
    if (bg && owner) {
      s.select(owner.id, bg.id);
      return;
    }
    if (p.layers[0].locked) {
      onError("ปลดล็อกเลเยอร์ล่างสุดก่อนเพิ่มพื้นหลัง");
      return;
    }
    if (p.layers.flatMap((l) => l.objects).length >= MAX_OBJECTS) {
      onError("ถึงขีดจำกัดวัตถุ");
      return;
    }
    const o = {
      ...baseObject("background"),
      width: p.width,
      height: p.height,
      fill: "#ffffff",
      fill2: "#c7d2fe",
      backgroundMode: "solid" as const,
      gradientAngle: 90,
    };
    s.change((p) => p.layers[0].objects.unshift(o));
    s.select(p.layers[0].id, o.id);
  }
  return (
    <button className="wide" onClick={add}>
      {bg ? "แก้ไขแผ่นพื้นหลัง" : "เพิ่มแผ่นพื้นหลัง"}
    </button>
  );
}
