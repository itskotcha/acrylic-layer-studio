import { useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import ArtNode from "./ArtNode";
import { baseObject, type ArtObject, type BrushType } from "../model";
export default function BrushPad({
  brushType,
  color,
  opacity,
  size,
}: {
  brushType: BrushType;
  color: string;
  opacity: number;
  size: number;
}) {
  const ref = useRef<any>(null);
  const [points, setPoints] = useState<number[]>([
    12, 55, 36, 30, 64, 54, 95, 29, 132, 54, 176, 26, 214, 48,
  ]);
  const down = useRef(false);
  useEffect(
    () =>
      setPoints([12, 55, 36, 30, 64, 54, 95, 29, 132, 54, 176, 26, 214, 48]),
    [brushType],
  );
  const o: ArtObject = {
    ...baseObject("stroke"),
    width: 230,
    height: 80,
    points,
    brushType,
    brushVersion: 1,
    seed: 23,
    strokeWidth: size,
    opacity,
    fill: color,
  };
  return (
    <div className="brush-pad">
      <small>ทดลองเส้น — ไม่เปลี่ยนชิ้นงาน</small>
      <Stage
        ref={ref}
        width={230}
        height={80}
        onPointerDown={() => {
          down.current = true;
          const p = ref.current.getPointerPosition();
          setPoints([p.x, p.y, p.x + 0.01, p.y + 0.01]);
        }}
        onPointerMove={() => {
          if (down.current) {
            const p = ref.current.getPointerPosition();
            setPoints((a) => [...a, p.x, p.y]);
          }
        }}
        onPointerUp={() => (down.current = false)}
        onPointerLeave={() => (down.current = false)}
      >
        <Layer>
          <ArtNode o={o} assets={{}} scale={2} listening={false} />
        </Layer>
      </Stage>
    </div>
  );
}
