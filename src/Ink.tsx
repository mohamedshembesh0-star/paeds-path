import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Eraser, Eye, EyeOff, Hand, Highlighter, PenLine, Redo2, Trash2, Undo2, X } from "lucide-react";

/* Notability-style ink: Apple Pencil / mouse draws, finger scrolls and taps (unless finger drawing is on).
   Strokes are stored in page coordinates per "scope" (route, or the current question inside a session). */

type Tool = "pen" | "hl" | "eraser";
type Stroke = { t: "pen" | "hl"; c: string; w: number; p: number[]; b: [number, number, number, number] }; // p = x,y,pressure*100 …; b = bbox
type Store = Record<string, Stroke[]>;

const KEY = "paeds-ink-v1";
const PEN_COLORS = ["#1f2a37", "#c0392b", "#1d5fbf", "#2e7d4f", "#7b3fa0"];
const HL_COLORS = ["#ffe14d", "#7ee08a", "#ff9ecf", "#7cc7ff"];
const SIZES = [1.6, 2.8, 4.5];

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

type InkCtx = { setOverride: (scope: string | null) => void; active: boolean; setActive: (v: boolean) => void };
const Ctx = createContext<InkCtx | null>(null);

/** Give the current screen its own ink page (e.g. one per quiz question). */
export function useInkScope(scope: string) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    ctx?.setOverride(scope);
    return () => ctx?.setOverride(null);
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useInk() {
  return useContext(Ctx);
}

/** Origin for x so ink stays attached to content when the sidebar shows/hides. */
function anchorLeft(): number {
  const main = document.querySelector(".main-area") as HTMLElement | null;
  return main ? main.getBoundingClientRect().left + window.scrollX : 0;
}

function bbox(p: number[], pad: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    x0 = Math.min(x0, p[i]); y0 = Math.min(y0, p[i + 1]);
    x1 = Math.max(x1, p[i]); y1 = Math.max(y1, p[i + 1]);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const p = s.p;
  if (p.length < 3) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (s.t === "hl") {
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w * 5;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  if (p.length === 3) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], s.w * 0.6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Smooth with midpoint quadratics; width follows pressure.
  for (let i = 3; i < p.length; i += 3) {
    const x0 = i >= 6 ? (p[i - 6] + p[i - 3]) / 2 : p[i - 3];
    const y0 = i >= 6 ? (p[i - 5] + p[i - 2]) / 2 : p[i - 2];
    const x1 = (p[i - 3] + p[i]) / 2;
    const y1 = (p[i - 2] + p[i + 1]) / 2;
    const pr = (p[i - 1] + p[i + 2]) / 200;
    ctx.lineWidth = s.w * (0.45 + pr * 1.1);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(p[i - 3], p[i - 2], i + 3 >= p.length ? p[i] : x1, i + 3 >= p.length ? p[i + 1] : y1);
    ctx.stroke();
  }
}

export function InkProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const value = useMemo(() => ({ setOverride, active, setActive }), [active]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <InkLayer scopeOverride={override} active={active} setActive={setActive} />
    </Ctx.Provider>
  );
}

function InkLayer({ scopeOverride, active, setActive }: { scopeOverride: string | null; active: boolean; setActive: (v: boolean) => void }) {
  const [location] = useLocation();
  const scope = scopeOverride ?? location;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useRef<Store>(loadStore());
  const undo = useRef<Record<string, Stroke[][]>>({});
  const redo = useRef<Record<string, Stroke[][]>>({});
  const current = useRef<Stroke | null>(null);
  const erasing = useRef(false);
  const tap = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState(PEN_COLORS[1]);
  const [hlColor, setHlColor] = useState(HL_COLORS[0]);
  const [size, setSize] = useState(1);
  const [finger, setFinger] = useState(false);
  const [visible, setVisible] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [, bump] = useState(0);
  const frame = useRef(0);
  const saveTimer = useRef(0);

  const strokes = () => store.current[scope] ?? [];

  const save = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        const clean: Store = {};
        for (const [k, v] of Object.entries(store.current)) if (v.length) clean[k] = v;
        localStorage.setItem(KEY, JSON.stringify(clean));
      } catch {
        /* storage full or blocked: ink stays for this visit */
      }
    }, 400);
  }, []);

  const render = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = window.innerWidth, h = window.innerHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!visible) return;
      const ox = anchorLeft() - window.scrollX, oy = -window.scrollY;
      ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
      const vx0 = -ox, vy0 = -oy, vx1 = vx0 + w, vy1 = vy0 + h;
      const list = current.current ? [...strokes(), current.current] : strokes();
      for (const s of list) {
        const b = s.b;
        if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
        drawStroke(ctx, s);
      }
    });
  }, [scope, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    render();
    const onMove = () => render();
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    // Content height can change (answers revealed); keep ink aligned.
    const ro = new ResizeObserver(onMove);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      ro.disconnect();
    };
  }, [render]);

  const commit = (next: Stroke[]) => {
    (undo.current[scope] ??= []).push(strokes());
    if (undo.current[scope].length > 60) undo.current[scope].shift();
    redo.current[scope] = [];
    store.current[scope] = next;
    save();
    bump((x) => x + 1);
    render();
  };

  const toDoc = (e: PointerEvent | React.PointerEvent) => [e.clientX + window.scrollX - anchorLeft(), e.clientY + window.scrollY];

  const eraseAt = (x: number, y: number) => {
    const r = 14;
    const list = strokes();
    const keep = list.filter((s) => {
      const b = s.b;
      if (x < b[0] - r || x > b[2] + r || y < b[1] - r || y > b[3] + r) return true;
      for (let i = 0; i < s.p.length; i += 3) if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < r + s.w) return false;
      return true;
    });
    if (keep.length !== list.length) {
      store.current[scope] = keep;
      save();
      render();
    }
  };

  const drawsWith = (e: React.PointerEvent) => e.pointerType === "pen" || e.pointerType === "mouse" || finger;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    if (!drawsWith(e)) {
      // Finger in pen mode: remember it so a quick tap can reach the page underneath.
      tap.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toDoc(e);
    if (tool === "eraser") {
      (undo.current[scope] ??= []).push(strokes());
      redo.current[scope] = [];
      erasing.current = true;
      eraseAt(x, y);
      return;
    }
    const pr = e.pointerType === "pen" ? Math.max(0.05, e.pressure || 0.5) : 0.5;
    current.current = { t: tool === "hl" ? "hl" : "pen", c: tool === "hl" ? hlColor : penColor, w: SIZES[size], p: [x, y, Math.round(pr * 100)], b: [x, y, x, y] };
    render();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    if (erasing.current) {
      const [x, y] = toDoc(e);
      eraseAt(x, y);
      return;
    }
    const s = current.current;
    if (!s) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = toDoc(ev);
      const lx = s.p[s.p.length - 3], ly = s.p[s.p.length - 2];
      if (Math.hypot(x - lx, y - ly) < 0.8) continue;
      const pr = ev.pointerType === "pen" ? Math.max(0.05, ev.pressure || 0.5) : 0.5;
      s.p.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pr * 100));
    }
    render();
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = tap.current;
    if (t && t.id === e.pointerId) {
      tap.current = null;
      if (Date.now() - t.t < 350 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) {
        const canvas = canvasRef.current!;
        canvas.style.pointerEvents = "none";
        const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        canvas.style.pointerEvents = "";
        target?.click();
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) target.focus();
      }
      return;
    }
    if (erasing.current) {
      erasing.current = false;
      bump((x) => x + 1);
      return;
    }
    const s = current.current;
    current.current = null;
    if (!s) return;
    s.b = bbox(s.p, s.w * (s.t === "hl" ? 5 : 2));
    commit([...strokes(), s]);
  };

  // iPad: stop the Pencil from scrolling (finger still scrolls natively unless finger drawing is on).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onTouch = (ev: TouchEvent) => {
      if (!active) return;
      const t = ev.touches[0] as Touch & { touchType?: string };
      if (finger || t?.touchType === "stylus") ev.preventDefault();
    };
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchmove", onTouch);
    };
  }, [active, finger]);

  const doUndo = () => {
    const stack = undo.current[scope];
    if (!stack?.length) return;
    (redo.current[scope] ??= []).push(strokes());
    store.current[scope] = stack.pop()!;
    save(); bump((x) => x + 1); render();
  };
  const doRedo = () => {
    const stack = redo.current[scope];
    if (!stack?.length) return;
    (undo.current[scope] ??= []).push(strokes());
    store.current[scope] = stack.pop()!;
    save(); bump((x) => x + 1); render();
  };

  useEffect(() => setConfirmClear(false), [scope, active]);

  const count = strokes().length;
  const canUndo = !!undo.current[scope]?.length;
  const canRedo = !!redo.current[scope]?.length;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`ink-canvas ${active ? "on" : ""} ${active && finger ? "finger" : ""} ${tool === "eraser" ? "erase" : ""}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-hidden="true"
      />
      {!active ? (
        <button className="ink-fab" onClick={() => setActive(true)} aria-label="Write on this page">
          <PenLine size={20} />
          {count > 0 && <i>{count}</i>}
        </button>
      ) : (
        <div className="ink-bar" role="toolbar" aria-label="Ink tools">
          <div className="ink-group">
            <button className={tool === "pen" ? "on" : ""} onClick={() => setTool("pen")} aria-label="Pen" aria-pressed={tool === "pen"}><PenLine size={19} /></button>
            <button className={tool === "hl" ? "on" : ""} onClick={() => setTool("hl")} aria-label="Highlighter" aria-pressed={tool === "hl"}><Highlighter size={19} /></button>
            <button className={tool === "eraser" ? "on" : ""} onClick={() => setTool("eraser")} aria-label="Eraser" aria-pressed={tool === "eraser"}><Eraser size={19} /></button>
          </div>
          {tool !== "eraser" && (
            <div className="ink-group colors">
              {(tool === "hl" ? HL_COLORS : PEN_COLORS).map((c) => (
                <button key={c} className={`swatch ${(tool === "hl" ? hlColor : penColor) === c ? "on" : ""}`} style={{ ["--sw" as string]: c }} onClick={() => (tool === "hl" ? setHlColor(c) : setPenColor(c))} aria-label={`Colour ${c}`} />
              ))}
            </div>
          )}
          {tool !== "eraser" && (
            <div className="ink-group sizes">
              <button onClick={() => setSize((size + 1) % SIZES.length)} aria-label={`Line size: ${["thin", "medium", "thick"][size]}. Tap to change`}><span style={{ width: 4 + size * 4, height: 4 + size * 4 }} /></button>
            </div>
          )}
          <div className="ink-group">
            <button className={finger ? "on" : ""} onClick={() => setFinger(!finger)} aria-label="Draw with finger" aria-pressed={finger} title="Draw with finger (off: finger scrolls and taps)"><Hand size={19} /></button>
            <button onClick={doUndo} disabled={!canUndo} aria-label="Undo"><Undo2 size={19} /></button>
            <button onClick={doRedo} disabled={!canRedo} aria-label="Redo"><Redo2 size={19} /></button>
            <button onClick={() => setVisible(!visible)} aria-label={visible ? "Hide ink" : "Show ink"}>{visible ? <Eye size={19} /> : <EyeOff size={19} />}</button>
            {confirmClear ? (
              <button className="danger" onClick={() => { commit([]); setConfirmClear(false); }} aria-label="Confirm clear page">Clear?</button>
            ) : (
              <button onClick={() => setConfirmClear(true)} disabled={!count} aria-label="Clear this page"><Trash2 size={19} /></button>
            )}
          </div>
          <button className="ink-done" onClick={() => setActive(false)} aria-label="Stop writing"><X size={19} /> Done</button>
        </div>
      )}
    </>
  );
}
