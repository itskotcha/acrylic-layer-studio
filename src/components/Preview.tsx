import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  RoundedBox,
  Edges,
} from "@react-three/drei";
import * as THREE from "three";
import { useStudio } from "../store";
import { rasterLayer, canvasBlob } from "../raster";
import { download, safeName } from "../io";
import type { DepthLayer, Project, Assets } from "../model";
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fallback">
        ไม่สามารถเปิด WebGL ได้ กรุณากลับไปโหมด 2D เพื่อบันทึกงาน
        หรือเปิดด้วยเบราว์เซอร์ที่รองรับการเร่งกราฟิก
      </div>
    ) : (
      this.props.children
    );
  }
}
function ArtPlane({
  p,
  l,
  assets,
  exploded,
  max,
  onError,
  onTextureReady,
}: {
  p: Project;
  l: DepthLayer;
  assets: Assets;
  exploded: boolean;
  max: number;
  onError: (s: string) => void;
  onTextureReady: (id: string, signature: string) => void;
}) {
  const [tex, setTex] = useState<THREE.CanvasTexture>();
  const invalidate = useThree((s) => s.invalidate);
  const signature = JSON.stringify(l.objects);
  const w = (3 * p.width) / p.height;
  const z = (l.depth - 0.5) * p.thickness * (exploded ? 5 : 1);
  useEffect(() => {
    let cancelled = false;
    let owned: THREE.CanvasTexture | undefined;
    const timer = setTimeout(() => {
      rasterLayer(p, l, assets, max)
        .then((c) => {
          if (cancelled) return;
          owned = new THREE.CanvasTexture(c);
          owned.colorSpace = THREE.SRGBColorSpace;
          owned.anisotropy = 4;
          setTex(owned);
          onTextureReady(l.id, signature);
          invalidate();
        })
        .catch((e) => {
          if (!cancelled) onError(String(e));
        });
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      owned?.dispose();
    };
  }, [signature, p.width, p.height, max]);
  return tex ? (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[w, 3]} />
      <meshBasicMaterial
        map={tex}
        transparent
        alphaTest={0.002}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  ) : null;
}
function Scene({
  auto,
  exploded,
  front,
  quality,
  onError,
  onReady,
}: {
  auto: boolean;
  exploded: boolean;
  front: number;
  quality: string;
  onError: (s: string) => void;
  onReady: (fn: () => Promise<void>) => void;
}) {
  const { project: p, assets } = useStudio();
  const controls = useRef<any>(null);
  const loaded = useRef(new Map<string, string>());
  const { gl, scene, camera, invalidate, size } = useThree();
  const w = (3 * p.width) / p.height;
  const shadow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(26,53,65,0.23)");
    g.addColorStop(0.4, "rgba(26,53,65,0.12)");
    g.addColorStop(1, "rgba(26,53,65,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => shadow.dispose(), [shadow]);
  useEffect(() => {
    const c = camera as THREE.OrthographicCamera;
    c.zoom = Math.min(size.width / (w + 2), size.height / 4.8);
    c.updateProjectionMatrix();
    invalidate();
  }, [size.width, size.height, w, camera, invalidate]);
  useEffect(() => {
    camera.position.set(front % 2 === 1 ? 0 : 4, front % 2 === 1 ? 0 : 2.2, 8);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [front, camera, invalidate]);
  useEffect(() => {
    onReady(async () => {
      if (
        p.layers.some(
          (l) =>
            l.visible && loaded.current.get(l.id) !== JSON.stringify(l.objects),
        )
      )
        throw new Error(
          "กำลังเตรียมภาพแต่ละชั้น กรุณารอสักครู่แล้วส่งออกอีกครั้ง",
        );
      gl.render(scene, camera);
      download(await canvasBlob(gl.domElement), `${safeName(p.name)}-3d.png`);
    });
  }, [gl, scene, camera, p, onReady]);
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={2} />
      <Environment resolution={128}>
        <Lightformer position={[-4, 3, 5]} scale={[3, 6, 1]} intensity={4} />
        <Lightformer position={[4, 0, 3]} scale={[1, 5, 1]} intensity={3} />
        <Lightformer
          position={[0, 5, -3]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[5, 3, 1]}
          intensity={2}
        />
      </Environment>
      {p.layers
        .filter((l) => l.visible)
        .map((l) => (
          <ArtPlane
            key={l.id}
            p={p}
            l={l}
            assets={assets}
            exploded={exploded}
            max={quality === "high" ? 2048 : 1024}
            onError={onError}
            onTextureReady={(id, sig) => loaded.current.set(id, sig)}
          />
        ))}
      {!exploded && (
        <group>
          <RoundedBox
            args={[w + 0.06, 3.06, p.thickness]}
            radius={0.025}
            smoothness={3}
            renderOrder={10}
          >
            <meshPhysicalMaterial
              color="#d4f2f5"
              roughness={0.08}
              metalness={0.12}
              transparent
              opacity={0.065}
              depthWrite={false}
              side={THREE.FrontSide}
              envMapIntensity={1.8}
              clearcoat={1}
            />
          </RoundedBox>
          <mesh renderOrder={11}>
            <boxGeometry args={[w + 0.06, 3.06, p.thickness]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color="#80a9b8" transparent opacity={0.62} />
          </mesh>
          {[-1, 1].map((sign) => (
            <mesh
              key={"side" + sign}
              position={[sign * (w / 2 + 0.025), 0, 0]}
              renderOrder={9}
            >
              <boxGeometry args={[0.015, 3.04, p.thickness]} />
              <meshPhysicalMaterial
                color="#9ac7d2"
                metalness={0.28}
                roughness={0.12}
                transparent
                opacity={0.28}
                depthWrite={false}
                envMapIntensity={2}
                clearcoat={1}
              />
            </mesh>
          ))}
          {[-1, 1].map((sign) => (
            <mesh
              key={"edge" + sign}
              position={[0, sign * 1.525, 0]}
              renderOrder={9}
            >
              <boxGeometry args={[w + 0.04, 0.012, p.thickness]} />
              <meshPhysicalMaterial
                color="#cbe7ec"
                metalness={0.22}
                roughness={0.1}
                transparent
                opacity={0.34}
                depthWrite={false}
                envMapIntensity={2}
              />
            </mesh>
          ))}
        </group>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.59, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial color="#e9eeef" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.58, 0]}>
        <planeGeometry args={[w * 2, 2.7]} />
        <meshBasicMaterial
          map={shadow}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <OrbitControls
        ref={controls}
        makeDefault
        autoRotate={auto}
        autoRotateSpeed={1.4}
        enablePan={false}
        minZoom={25}
        maxZoom={600}
        minPolarAngle={0.03}
        maxPolarAngle={Math.PI - 0.03}
      />
    </>
  );
}
export default function Preview({ onError }: { onError: (s: string) => void }) {
  const [auto, setAuto] = useState(false),
    [exploded, setExploded] = useState(false),
    [front, setFront] = useState(0),
    [quality, setQuality] = useState("high"),
    [lost, setLost] = useState(false);
  const exportFn = useRef<() => Promise<void>>(async () => {});
  const ready = useMemo(
    () => (fn: () => Promise<void>) => {
      exportFn.current = fn;
    },
    [],
  );
  return (
    <div className="preview-wrap" data-testid="preview">
      <Boundary>
        <Canvas
          orthographic
          flat
          frameloop={auto ? "always" : "demand"}
          dpr={quality === "high" ? [1, 1.75] : 1}
          camera={{ position: [4, 2.2, 8], fov: 32 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.setClearColor("#e9eeef");
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setLost(true);
            });
            gl.domElement.addEventListener("webglcontextrestored", () =>
              setLost(false),
            );
          }}
          fallback={
            <div className="fallback">
              WebGL ไม่พร้อมใช้งาน กลับไปโหมด 2D เพื่อบันทึกงานได้
            </div>
          }
        >
          <Scene
            auto={auto}
            exploded={exploded}
            front={front}
            quality={quality}
            onError={onError}
            onReady={ready}
          />
        </Canvas>
      </Boundary>
      {lost && (
        <div className="fallback overlay">
          การแสดงผล 3D หยุดชั่วคราว กรุณาสลับกลับ 2D แล้วเปิด 3D ใหม่
        </div>
      )}
      <div className="preview-hint">ลากเพื่อหมุน 360° · เลื่อนเพื่อซูม</div>
      <div className="preview-controls">
        <button className={auto ? "active" : ""} onClick={() => setAuto(!auto)}>
          {auto ? "หยุดหมุน" : "หมุนอัตโนมัติ"}
        </button>
        <button onClick={() => setFront((n) => n + 1)}>มุมหน้า / รีเซ็ต</button>
        <button
          className={exploded ? "active" : ""}
          onClick={() => setExploded(!exploded)}
        >
          {exploded ? "ประกอบกลับ" : "แยกชั้น"}
        </button>
        <select
          aria-label="คุณภาพพรีวิว"
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
        >
          <option value="high">คุณภาพสูง</option>
          <option value="low">ประหยัดพลังงาน</option>
        </select>
        <button
          onClick={() => exportFn.current().catch((e) => onError(String(e)))}
        >
          บันทึกภาพ 3D
        </button>
      </div>
    </div>
  );
}
