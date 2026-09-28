import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useStudio } from "../store";
import type { ArtObject, Project } from "../model";
import { rotateAboutCenter } from "../geometry";
export const useRotationPreview = create<{
  object: ArtObject | null;
  source: Project | null;
}>(() => ({ object: null, source: null }));
export default function RotationControl() {
  const { project, layerId, objectId, patchObject } = useStudio();
  const layer = project.layers.find((l) => l.id === layerId);
  const object = layer?.objects.find((o) => o.id === objectId);
  const [angle, setAngle] = useState(String(object?.rotation ?? 0));
  const pending = useRef<number | null>(null);
  const skipBlur = useRef(false);
  const disabled = !object || object.locked || layer?.locked;
  const clear = () => {
    pending.current = null;
    useRotationPreview.setState({ object: null, source: null });
  };
  useEffect(() => {
    clear();
    setAngle(String(object?.rotation ?? 0));
  }, [project, objectId]);
  useEffect(
    () => () => useRotationPreview.setState({ object: null, source: null }),
    [],
  );
  function commit(value: number) {
    if (object && !disabled && Number.isFinite(value))
      patchObject(rotateAboutCenter(object, value));
    if (Number.isFinite(value)) setAngle(String(((value % 360) + 360) % 360));
    clear();
  }
  function finish() {
    if (pending.current !== null) commit(pending.current);
  }
  return (
    <fieldset className="rotation-controls" disabled={disabled}>
      <label className="field">
        มุมหมุน °
        <input
          aria-label="มุมหมุน °"
          type="number"
          min={0}
          max={360}
          step={1}
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skipBlur.current = true;
              setAngle(String(object?.rotation ?? 0));
              e.currentTarget.blur();
            }
          }}
          onBlur={() => {
            if (skipBlur.current) {
              skipBlur.current = false;
              return;
            }
            const v = Number(angle);
            if (angle.trim() !== "" && Number.isFinite(v))
              commit(Math.max(0, Math.min(360, v)));
            else setAngle(String(object?.rotation ?? 0));
          }}
        />
      </label>
      <input
        aria-label="เลื่อนมุมหมุน"
        type="range"
        min={0}
        max={360}
        step={1}
        value={Number(angle) || 0}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onChange={(e) => {
          const v = +e.target.value;
          setAngle(String(v));
          pending.current = v;
          if (object)
            useRotationPreview.setState({
              object: rotateAboutCenter(object, v),
              source: project,
            });
        }}
        onPointerUp={finish}
        onKeyUp={finish}
        onBlur={finish}
        onPointerCancel={() => {
          clear();
          setAngle(String(object?.rotation ?? 0));
        }}
      />
      <div className="button-row">
        <button onClick={() => commit((object?.rotation ?? 0) - 90)}>
          −90°
        </button>
        <button onClick={() => commit((object?.rotation ?? 0) + 90)}>
          +90°
        </button>
        <button onClick={() => commit(0)}>คืนค่า 0°</button>
      </div>
    </fieldset>
  );
}
