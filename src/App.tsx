import {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  Hand,
  Settings,
  ClipboardPaste,
  Layers3,
  Plus,
  FolderOpen,
  Download,
  Undo2,
  Redo2,
  MousePointer2,
  PenLine,
  Eraser,
  Type,
  ImagePlus,
  Box,
  PanelsTopLeft,
  Menu,
  SlidersHorizontal,
  X,
  Check,
  LoaderCircle,
} from "lucide-react";
import { useStudio, deleteObject, duplicateObject } from "./store";
import {
  baseObject,
  layer,
  distribute,
  imageObject,
  MAX_LAYERS,
  MAX_OBJECTS,
  outputSize,
  type BrushType,
  type Project,
  type Assets,
} from "./model";
import {
  readImage,
  packProject,
  unpackProject,
  download,
  safeName,
  saveLocal,
  restoreLocal,
} from "./io";
import { exportFlat, exportLayers } from "./raster";
import { makeDemo, makeBrushDemo } from "./demo";
import Editor, { type Tool } from "./components/Editor";
import Properties from "./components/Properties";
import LayerList from "./components/LayerList";
import NewProject from "./components/NewProject";
import { usePreferences } from "./preferences";
import { BRUSHES } from "./brushes";
import { missingFonts, releaseUnusedFonts } from "./fonts";
import { MissingFonts } from "./components/FontPicker";
import Background from "./components/Background";
import { resetViews } from "./viewState";
import BrushPad from "./components/BrushPad";
const Preview = lazy(() => import("./components/Preview"));
export default function App() {
  const s = useStudio();
  const p = s.project;
  const prefs = usePreferences();
  const [brushType, setBrushType] = useState<BrushType>("round"),
    [eraseMode, setEraseMode] = useState<"stroke" | "partial">("partial");
  const [pending, setPending] = useState<{
    project: Project;
    assets: Assets;
  } | null>(null);
  const busyRef = useRef(false);
  const dims = outputSize(p, prefs.exportEdge);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        prefs.theme === "system"
          ? m.matches
            ? "dark"
            : "light"
          : prefs.theme);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [prefs.theme]);
  useEffect(() => {
    releaseUnusedFonts(p.fonts);
  }, [p.id]);
  const [mode, setMode] = useState<"2d" | "3d">("2d"),
    [tool, setTool] = useState<Tool>("select"),
    [color, setColor] = useState("#215d71"),
    [brush, setBrush] = useState(8),
    [inkOpacity, setInkOpacity] = useState(1),
    [newOpen, setNewOpen] = useState(false),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("กำลังเปิดงาน…"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState<"layers" | "props" | null>(null),
    [exports, setExports] = useState(false),
    [intoLayer, setIntoLayer] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (settingsOpen) settingsDialog.current?.showModal();
    else settingsDialog.current?.close();
  }, [settingsOpen]);
  const imageInput = useRef<HTMLInputElement>(null),
    openInput = useRef<HTMLInputElement>(null);
  const loadToken = useRef(0);
  const notify = useCallback(
    (text: string) => setNotice(text.replace(/^Error: /, "")),
    [],
  );
  const saveQueue = useRef(Promise.resolve());
  const activeSave = useRef(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await restoreLocal();
        if (!active) return;
        if (saved) s.replace(saved.project, saved.assets);
        else {
          const d = makeDemo();
          s.replace(d.project, d.assets);
          setNewOpen(true);
        }
      } catch (e) {
        if (active) {
          const d = makeDemo();
          s.replace(d.project, d.assets);
          notify("กู้งานอัตโนมัติไม่ได้: " + String(e));
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    setStatus("มีการแก้ไข…");
    const ticket = ++activeSave.current;
    const t = setTimeout(() => {
      setStatus("กำลังบันทึก…");
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveLocal(p, s.assets))
        .then(() => {
          if (ticket === activeSave.current) setStatus("บันทึกในเครื่องแล้ว");
        })
        .catch((e) => {
          if (ticket === activeSave.current) {
            setStatus("บันทึกไม่สำเร็จ");
            notify(
              "พื้นที่จัดเก็บอาจเต็ม กรุณาดาวน์โหลดโปรเจกต์: " + String(e),
            );
          }
        });
    }, 700);
    return () => clearTimeout(t);
  }, [p, s.assets, ready]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status !== "บันทึกในเครื่องแล้ว") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        ) ||
        newOpen ||
        pending ||
        settingsOpen ||
        busyRef.current
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateObject();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteObject();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [newOpen, pending, settingsOpen]);
  useEffect(() => {
    if (!p.layers.some((l) => l.id === s.layerId))
      s.select(p.layers.at(-1)!.id);
  }, [p, s.layerId]);
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const state = useStudio.getState();
      download(
        await packProject(state.project, state.assets, prefs.embedFonts),
        `${safeName(state.project.name)}.acrylic.zip`,
      );
      notify("ดาวน์โหลดโปรเจกต์แล้ว เปิดแก้ไขต่อได้จากเมนูเปิดงาน");
    });
  const canReplace = () =>
    confirm(
      "แทนที่งานปัจจุบัน? หากต้องการเก็บงานเดิม ให้ยกเลิกและกดบันทึกโปรเจกต์ก่อน",
    );
  function create(p: Project, a: Assets) {
    resetViews();
    loadToken.current++;
    s.replace(p, a);
    setNewOpen(false);
    setMode("2d");
    setTool("select");
  }
  async function importFiles(files: File[]) {
    const token = loadToken.current;
    const target = useStudio.getState().layerId;
    if (!files.length) return;
    const current = useStudio.getState();
    if (
      current.project.layers.reduce((n, l) => n + l.objects.length, 0) +
        files.length >
      MAX_OBJECTS
    )
      throw new Error("รองรับไม่เกิน 500 วัตถุ");
    if (
      intoLayer &&
      current.project.layers.find((l) => l.id === target)?.locked
    )
      throw new Error("กรุณาปลดล็อกชั้นก่อน");
    if (!intoLayer && current.project.layers.length + files.length > MAX_LAYERS)
      throw new Error("รองรับไม่เกิน 24 เลเยอร์");
    if (Object.keys(current.assets).length + files.length > 100)
      throw new Error(
        "รองรับไม่เกิน 100 ภาพต่อเซสชัน กรุณาบันทึกแล้วเปิดโปรเจกต์ใหม่",
      );
    const imported = await Promise.all(files.map(readImage));
    if (token !== loadToken.current) return;
    const additions = Object.fromEntries(imported.map((a) => [a.id, a]));
    const size = Object.values({ ...current.assets, ...additions }).reduce(
      (n, a) => n + a.data.length * 0.75,
      0,
    );
    if (size > 100e6) throw new Error("รูปทั้งหมดต้องไม่เกิน 100 MB");
    s.addAssets(additions);
    let last = target,
      lastObject = "";
    s.change((p) => {
      for (const a of imported) {
        let l = intoLayer ? p.layers.find((l) => l.id === target) : undefined;
        if (!l) {
          if (p.layers.length === 1 && p.layers[0].objects.length === 0)
            l = p.layers[0];
          else {
            l = layer(a.name);
            p.layers.push(l);
          }
          l.name = a.name;
        }
        const obj = imageObject(a, p);
        l.objects.push(obj);
        lastObject = obj.id;
        last = l.id;
      }
      distribute(p);
    });
    s.select(last, lastObject);
    setMode("2d");
    notify("นำเข้ารูปเรียบร้อย");
  }
  async function pasteClipboard() {
    if (!navigator.clipboard?.read)
      throw Error(
        "เบราว์เซอร์นี้ไม่รองรับปุ่มวางรูป ใช้ Ctrl/Cmd+V หรือนำเข้าไฟล์แทน",
      );
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) =>
          ["image/png", "image/jpeg", "image/webp"].includes(t),
        );
        if (type)
          files.push(
            new File(
              [await item.getType(type)],
              "clipboard." + type.split("/")[1],
              { type },
            ),
          );
      }
      if (!files.length)
        throw Error(
          "คลิปบอร์ดไม่มีไฟล์ภาพ ลองคัดลอกรูปภาพแทนลิงก์ หรือนำเข้าไฟล์",
        );
      await importFiles(files);
    } catch (e) {
      throw Error(
        "วางรูปไม่ได้: " +
          String(e) +
          " — ลองใช้เมนูคัดลอกรูปภาพ หรือนำเข้าไฟล์",
      );
    }
  }
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (
        newOpen ||
        pending ||
        mode !== "2d" ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        void run(() => importFiles(files));
      } else if (e.clipboardData?.getData("text/plain"))
        notify("คลิปบอร์ดเป็นข้อความหรือลิงก์ กรุณาคัดลอกรูปภาพหรือนำเข้าไฟล์");
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [newOpen, pending, mode, intoLayer, s.layerId]);
  function addText() {
    const l = p.layers.find((l) => l.id === s.layerId);
    if (!l || l.locked) {
      notify("กรุณาเลือกชั้นที่ไม่ได้ล็อก");
      return;
    }
    if (p.layers.reduce((n, l) => n + l.objects.length, 0) >= MAX_OBJECTS) {
      notify("ถึงขีดจำกัด 500 วัตถุ");
      return;
    }
    const o = {
      ...baseObject("text"),
      x: p.width * 0.15,
      y: p.height * 0.15,
      width: p.width * 0.7,
      height: p.height * 0.2,
      text: "ข้อความของคุณ",
      fontSize: p.width * 0.06,
      fontFamily: "Noto Sans Thai",
      align: "left" as const,
      fill: color,
    };
    s.change((p) => {
      p.layers.find((x) => x.id === l.id)!.objects.push(o);
    });
    s.select(l.id, o.id);
    setTool("select");
    setMode("2d");
    setMobile("props");
  }
  if (!ready)
    return (
      <div className="loading">
        <Layers3 size={40} />
        <p>กำลังเปิดสตูดิโอ…</p>
      </div>
    );
  return (
    <div className={"app mode-" + mode}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Layers3 size={24} />
          </div>
          <div>
            Acrylic<span>LAYER STUDIO</span>
          </div>
        </div>
        <div className="project-title">
          <input
            aria-label="ชื่อโปรเจกต์"
            value={p.name}
            maxLength={200}
            onChange={(e) =>
              s.change((p) => {
                p.name = e.target.value;
              })
            }
          />
          <small>
            <Check size={12} />
            {status}
          </small>
        </div>
        <div className="top-actions">
          <button
            title="ตั้งค่า"
            aria-label="ตั้งค่า"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} />
          </button>
          <button
            title="สร้างงานใหม่"
            onClick={() => {
              if (canReplace()) setNewOpen(true);
            }}
          >
            <Plus size={17} />
            <span>ใหม่</span>
          </button>
          <button
            aria-label="เปิดงาน"
            onClick={() => openInput.current?.click()}
          >
            <FolderOpen size={17} />
            <span>เปิดงาน</span>
          </button>
          <button title="ย้อนกลับ" disabled={!s.past.length} onClick={s.undo}>
            <Undo2 size={18} />
          </button>
          <button title="ทำซ้ำ" disabled={!s.future.length} onClick={s.redo}>
            <Redo2 size={18} />
          </button>
          <button
            className="save"
            aria-label="บันทึกโปรเจกต์"
            onClick={save}
            disabled={busy}
          >
            <Download size={17} />
            <span>บันทึกโปรเจกต์</span>
          </button>
          <div className="export-menu">
            <button
              className="primary"
              disabled={busy}
              onClick={() => setExports(!exports)}
            >
              ส่งออก <span>⌄</span>
            </button>
            {exports && (
              <div className="dropdown">
                <label className="field">
                  ความละเอียดส่งออก
                  <select
                    aria-label="ความละเอียดส่งออก"
                    value={prefs.exportEdge}
                    onChange={(e) => prefs.set({ exportEdge: +e.target.value })}
                  >
                    <option value={1024}>1K</option>
                    <option value={2048}>2K</option>
                    <option value={4096}>4K</option>
                  </select>
                </label>
                <small>
                  {dims.width} × {dims.height} px · ภาพ 2D
                </small>
                <small>
                  เพิ่มพิกเซลไม่เพิ่มรายละเอียดของภาพต้นฉบับที่มีขนาดเล็ก
                </small>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={prefs.embedFonts}
                    onChange={(e) =>
                      prefs.set({ embedFonts: e.target.checked })
                    }
                  />
                  ฝังฟอนต์ในโปรเจกต์ ZIP
                </label>
                <small>ฝังเฉพาะฟอนต์ที่มีสิทธิ์แจกจ่าย</small>
                <button
                  onClick={() => {
                    setExports(false);
                    void run(() => exportFlat(p, s.assets, prefs.exportEdge));
                  }}
                >
                  PNG · ภาพด้านหน้า
                </button>
                <button
                  onClick={() => {
                    setExports(false);
                    void run(() => exportLayers(p, s.assets, prefs.exportEdge));
                  }}
                >
                  ZIP · ภาพแยกทุกชั้น
                </button>
                <button
                  onClick={() => {
                    setExports(false);
                    setMode("3d");
                    notify("เลือกมุม แล้วกด “บันทึกภาพ 3D” ใต้พรีวิว");
                  }}
                >
                  PNG · มุมสามมิติ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="workspace">
        <aside
          className={
            "sidebar panel " + (mobile === "layers" ? "mobile-open" : "")
          }
        >
          <button className="mobile-close" onClick={() => setMobile(null)}>
            <X />
            ปิดเครื่องมือ
          </button>
          <div className="panel-heading">เครื่องมือ</div>
          <div className="tools">
            <button
              className={tool === "select" ? "active" : ""}
              onClick={() => {
                setTool("select");
                setMode("2d");
              }}
            >
              <MousePointer2 />
              เลือก
            </button>
            <button
              className={tool === "pen" ? "active" : ""}
              onClick={() => {
                setTool("pen");
                setMode("2d");
              }}
            >
              <PenLine />
              ปากกา
            </button>
            <button
              className={tool === "eraser" ? "active" : ""}
              onClick={() => {
                setTool("eraser");
                setMode("2d");
              }}
            >
              <Eraser />
              ลบเส้น
            </button>
            <button onClick={addText}>
              <Type />
              ข้อความ
            </button>
          </div>
          <button
            className={tool === "pan" ? "wide active" : "wide"}
            onClick={() => {
              setTool("pan");
              setMode("2d");
            }}
          >
            <Hand size={17} />
            เลื่อนผืนงาน
          </button>
          <details className="import-block">
            <summary>
              <ImagePlus size={17} />
              รูปภาพ
            </summary>
            <button
              className="wide"
              disabled={busy}
              onClick={() => imageInput.current?.click()}
            >
              <ImagePlus size={17} />
              เพิ่มรูปภาพ
            </button>
            <button className="wide" onClick={() => void run(pasteClipboard)}>
              <ClipboardPaste size={17} />
              วางจากคลิปบอร์ด
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={intoLayer}
                onChange={(e) => setIntoLayer(e.target.checked)}
              />
              เพิ่มลงชั้นที่เลือก
            </label>
          </details>
          <div className="background-tool">
            <Background onError={notify} />
          </div>
          {(tool === "pen" || tool === "eraser") && (
            <div className="brush-controls">
              {tool === "pen" && (
                <>
                  <label className="field">
                    หัวปากกา
                    <select
                      aria-label="หัวปากกา"
                      value={brushType}
                      onChange={(e) =>
                        setBrushType(e.target.value as BrushType)
                      }
                    >
                      {BRUSHES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BrushPad
                    brushType={brushType}
                    color={color}
                    opacity={inkOpacity}
                    size={brush}
                  />
                </>
              )}
              {tool === "eraser" && (
                <label className="field">
                  วิธีลบ
                  <select
                    aria-label="วิธีลบ"
                    value={eraseMode}
                    onChange={(e) => setEraseMode(e.target.value as any)}
                  >
                    <option value="partial">ลบบางส่วนของเส้น</option>
                    <option value="stroke">ลบทั้งเส้น</option>
                  </select>
                </label>
              )}
              <label>
                สี{" "}
                <input
                  aria-label="สีปากกา"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
              <label>
                ขนาด {brush}
                <input
                  aria-label="ขนาดปากกา"
                  type="range"
                  min={1}
                  max={100}
                  value={brush}
                  onChange={(e) => setBrush(+e.target.value)}
                />
              </label>
              <label>
                ความทึบ {Math.round(inkOpacity * 100)}%
                <input
                  aria-label="ความทึบปากกา"
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={inkOpacity}
                  onChange={(e) => setInkOpacity(+e.target.value)}
                />
              </label>
              {tool === "eraser" && (
                <small>ลากบนเส้นวาดเพื่อลบ · รูปและข้อความไม่ถูกลบ</small>
              )}
            </div>
          )}
          <LayerList onError={notify} />
          <button
            className="demo-button"
            onClick={() => {
              if (canReplace()) {
                const d = makeBrushDemo();
                create(d.project, d.assets);
              }
            }}
          >
            ตัวอย่างหัวปากกาและพื้นหลัง
          </button>
          <button
            className="demo-button"
            onClick={() => {
              if (canReplace()) {
                const d = makeDemo();
                create(d.project, d.assets);
              }
            }}
          >
            เปิดงานตัวอย่าง
          </button>
        </aside>
        <main>
          <div className="workspace-bar">
            <div className="tabs">
              <button
                className={mode === "2d" ? "active" : ""}
                onClick={() => setMode("2d")}
              >
                <PanelsTopLeft size={17} />
                ออกแบบ 2D
              </button>
              <button
                className={mode === "3d" ? "active" : ""}
                onClick={() => setMode("3d")}
              >
                <Box size={17} />
                ดูแบบ 3D
              </button>
            </div>
          </div>
          <div
            className="canvas-area"
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              if (files.length) void run(() => importFiles(files));
            }}
          >
            {mode === "2d" ? (
              <Editor
                tool={tool}
                color={color}
                brush={brush}
                inkOpacity={inkOpacity}
                brushType={brushType}
                eraseMode={eraseMode}
                onError={notify}
              />
            ) : (
              <Suspense
                fallback={<div className="loading">กำลังเปิดพรีวิว…</div>}
              >
                <Preview onError={notify} />
              </Suspense>
            )}
            {p.layers.every((l) => !l.objects.length) && mode === "2d" && (
              <div className="empty-hint">
                <ImagePlus />
                <strong>เริ่มออกแบบ</strong>
                <span>เพิ่มรูปภาพ แล้วจัดวางเป็นชั้น ๆ</span>
                <button
                  className="primary"
                  onClick={() => imageInput.current?.click()}
                >
                  นำเข้ารูปภาพ
                </button>
              </div>
            )}
          </div>
          <footer className="workspace-footer">
            <span>
              {mode === "2d"
                ? tool === "pen"
                  ? "ลากเพื่อวาดบนชั้นที่เลือก"
                  : tool === "eraser"
                    ? eraseMode === "partial"
                      ? "ลากเพื่อลบบางส่วนของเส้น"
                      : "แตะเส้นวาดเพื่อลบทั้งเส้น"
                    : "เลือกวัตถุเพื่อย้าย ปรับขนาด และหมุน"
                : "ด้านหลังแสดงภาพกลับด้านตามการมองผ่านแผ่น"}
            </span>
            <span>ทำงานในเครื่องของคุณ</span>
          </footer>
        </main>
        <div
          className={
            "props-holder " + (mobile === "props" ? "mobile-open" : "")
          }
        >
          <button className="mobile-close" onClick={() => setMobile(null)}>
            <X />
            ปิดคุณสมบัติ
          </button>
          <Properties onError={notify} mode={mode} />
        </div>
      </div>
      {mobile && (
        <button
          className="drawer-backdrop"
          aria-label="ปิดแผง"
          onClick={() => setMobile(null)}
        />
      )}
      <dialog
        ref={settingsDialog}
        className="settings-dialog"
        onCancel={() => setSettingsOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSettingsOpen(false);
        }}
      >
        <div className="panel-heading">
          ตั้งค่า
          <button
            aria-label="ปิดตั้งค่า"
            onClick={() => setSettingsOpen(false)}
          >
            <X size={18} />
          </button>
        </div>{" "}
        <div className="studio-settings">
          <label className="field">
            ธีม
            <select
              aria-label="ธีม"
              value={prefs.theme}
              onChange={(e) => prefs.set({ theme: e.target.value as any })}
            >
              <option value="light">สว่าง</option>
              <option value="dark">มืด</option>
              <option value="system">ตามระบบ</option>
            </select>
          </label>
          <label className="field">
            พื้นโต๊ะทำงาน
            <select
              aria-label="พื้นโต๊ะทำงาน"
              value={prefs.desk}
              onChange={(e) => prefs.set({ desk: e.target.value as any })}
            >
              <option value="checker">ตารางโปร่งใส</option>
              <option value="white">ขาว</option>
              <option value="gray">เทา</option>
              <option value="black">ดำ</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.snap}
              onChange={(e) => prefs.set({ snap: e.target.checked })}
            />
            ช่วยจัดแนว
          </label>
        </div>
      </dialog>
      <nav className="mobile-nav">
        <button
          onClick={() => setMobile(mobile === "layers" ? null : "layers")}
        >
          <Menu size={18} />
          เครื่องมือ / ชั้น
        </button>
        <button onClick={() => setMobile(mobile === "props" ? null : "props")}>
          <SlidersHorizontal size={18} />
          คุณสมบัติ
        </button>
      </nav>
      <input
        ref={imageInput}
        data-testid="image-input"
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          void run(() => importFiles(files));
        }}
      />
      <input
        ref={openInput}
        data-testid="project-input"
        type="file"
        hidden
        accept=".zip,.acrylic.zip"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void run(async () => {
            const next = await unpackProject(file);
            if (canReplace()) {
              if (missingFonts(next.project).length) setPending(next);
              else create(next.project, next.assets);
            }
          });
        }}
      />
      {pending && (
        <MissingFonts
          value={pending}
          onCancel={() => setPending(null)}
          onOpen={(p, a) => {
            setPending(null);
            create(p, a);
          }}
          onError={notify}
        />
      )}
      {newOpen && (
        <NewProject
          onClose={() => setNewOpen(false)}
          onCreate={create}
          onError={notify}
        />
      )}{" "}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="ปิดข้อความ" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy">
          <LoaderCircle className="spin" />
          กำลังประมวลผล…
        </div>
      )}
    </div>
  );
}
