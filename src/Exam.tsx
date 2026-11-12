import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, CheckCheck, Droplets, Drum, Eye, Flashlight, Hand, ListChecks, RefreshCw, Ruler, Stethoscope, Volume2, VolumeX, Zap } from "lucide-react";
import type { Patient } from "./data/patients";
import { EXAM_MAPS, REGION_LABEL, TOOL_INFO, type Region, type Sounds, type Tool } from "./data/examMap";

/* A drawn patient you examine with tools: pick a tool, tap the body, get the finding (and hear it). */

const ICON: Record<Tool, typeof Eye> = { prep: Droplets, monitor: Activity, measure: Ruler, look: Eye, hand: Hand, percuss: Drum, steth: Stethoscope, light: Flashlight, reflex: Zap, finish: CheckCheck };

type Spot = { id: Region; x: number; y: number; rx: number; ry: number };
const SPOTS: Record<string, { front: Spot[]; back: Spot[] }> = {
  neonate: {
    front: [
      { id: "head", x: 150, y: 52, rx: 30, ry: 16 }, { id: "eyes", x: 150, y: 80, rx: 30, ry: 10 }, { id: "mouth", x: 150, y: 104, rx: 16, ry: 9 }, { id: "neck", x: 150, y: 135, rx: 22, ry: 8 },
      { id: "chestR", x: 124, y: 168, rx: 19, ry: 16 }, { id: "chestL", x: 180, y: 160, rx: 15, ry: 12 }, { id: "heart", x: 166, y: 186, rx: 15, ry: 12 }, { id: "baseR", x: 120, y: 204, rx: 18, ry: 14 }, { id: "baseL", x: 184, y: 212, rx: 14, ry: 11 },
      { id: "abdomen", x: 150, y: 242, rx: 36, ry: 19 }, { id: "groin", x: 150, y: 288, rx: 28, ry: 15 }, { id: "hands", x: 66, y: 150, rx: 18, ry: 18 }, { id: "hands", x: 234, y: 150, rx: 18, ry: 18 }, { id: "legs", x: 98, y: 338, rx: 24, ry: 28 }, { id: "legs", x: 202, y: 338, rx: 24, ry: 28 },
    ],
    back: [
      { id: "head", x: 150, y: 76, rx: 36, ry: 34 }, { id: "back", x: 150, y: 182, rx: 44, ry: 36 }, { id: "spine", x: 150, y: 256, rx: 30, ry: 24 }, { id: "legs", x: 98, y: 338, rx: 24, ry: 28 }, { id: "legs", x: 202, y: 338, rx: 24, ry: 28 }, { id: "hands", x: 66, y: 150, rx: 18, ry: 18 }, { id: "hands", x: 234, y: 150, rx: 18, ry: 18 },
    ],
  },
  teen: {
    front: [
      { id: "head", x: 150, y: 32, rx: 22, ry: 10 }, { id: "eyes", x: 150, y: 52, rx: 22, ry: 8 }, { id: "mouth", x: 150, y: 72, rx: 13, ry: 8 }, { id: "neck", x: 150, y: 98, rx: 16, ry: 9 },
      { id: "chestR", x: 122, y: 146, rx: 22, ry: 19 }, { id: "chestL", x: 182, y: 138, rx: 17, ry: 13 }, { id: "heart", x: 168, y: 170, rx: 17, ry: 14 }, { id: "baseR", x: 120, y: 196, rx: 22, ry: 17 }, { id: "baseL", x: 184, y: 202, rx: 17, ry: 13 },
      { id: "abdomen", x: 150, y: 246, rx: 40, ry: 22 }, { id: "hands", x: 62, y: 300, rx: 16, ry: 18 }, { id: "hands", x: 238, y: 300, rx: 16, ry: 18 }, { id: "legs", x: 124, y: 368, rx: 20, ry: 26 }, { id: "legs", x: 176, y: 368, rx: 20, ry: 26 },
    ],
    back: [
      { id: "head", x: 150, y: 50, rx: 28, ry: 28 }, { id: "neck", x: 150, y: 98, rx: 16, ry: 9 },
      { id: "backUL", x: 122, y: 148, rx: 23, ry: 22 }, { id: "backUR", x: 178, y: 148, rx: 23, ry: 22 }, { id: "backBL", x: 122, y: 202, rx: 23, ry: 22 }, { id: "backBR", x: 178, y: 202, rx: 23, ry: 22 },
      { id: "hands", x: 62, y: 300, rx: 16, ry: 18 }, { id: "hands", x: 238, y: 300, rx: 16, ry: 18 }, { id: "legs", x: 124, y: 368, rx: 20, ry: 26 }, { id: "legs", x: 176, y: 368, rx: 20, ry: 26 },
    ],
  },
};

/* ---------- sound (Web Audio, generated; nothing is downloaded) ---------- */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function thump(a: AudioContext, t: number, freq: number, dur: number, vol: number) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function playHeart(hr: number) {
  const a = audio(); if (!a) return;
  const beat = 60 / hr, t0 = a.currentTime + 0.05;
  for (let i = 0; i < Math.round(4 / beat); i++) { thump(a, t0 + i * beat, 70, 0.11, 0.9); thump(a, t0 + i * beat + beat * 0.36, 95, 0.08, 0.6); }
}
function playBreath(s: Sounds, bronchial: boolean, crackles: boolean) {
  const a = audio(); if (!a) return;
  const cycle = 60 / s.rr, total = Math.min(6, cycle * 3), t0 = a.currentTime + 0.05;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * total), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = bronchial ? "bandpass" : "lowpass"; f.frequency.value = bronchial ? 900 : 380; f.Q.value = bronchial ? 0.9 : 0.5;
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0);
  const peak = bronchial ? 0.5 : 0.28;
  for (let c = 0; c * cycle < total; c++) {
    const t = t0 + c * cycle, insp = cycle * 0.4, exp = cycle * (bronchial ? 0.45 : 0.25);
    g.gain.linearRampToValueAtTime(peak, t + insp * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + insp);
    g.gain.linearRampToValueAtTime(bronchial ? peak : peak * 0.35, t + insp + exp * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + insp + exp);
    if (crackles) for (let k = 0; k < 9; k++) thump(a, t + insp * (0.35 + 0.6 * Math.random()), 520 + Math.random() * 500, 0.012, 0.35);
  }
  src.connect(f).connect(g).connect(a.destination); src.start(t0); src.stop(t0 + total);
}
function playPercuss(dull: boolean) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + 0.03;
  for (const dt of [0, 0.32]) thump(a, t + dt, dull ? 300 : 135, dull ? 0.06 : 0.3, dull ? 0.5 : 0.9);
}

/* ---------- the drawn patient ---------- */
function Figure({ kind, back, rr }: { kind: string; back: boolean; rr: number }) {
  const breathe = { animationDuration: `${(60 / rr).toFixed(2)}s` };
  if (kind === "neonate") {
    return (
      <g>
        <defs>
          <linearGradient id="jaundice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecc56f" /><stop offset=".62" stopColor="#efc887" /><stop offset=".8" stopColor="#f3c3a6" /><stop offset="1" stopColor="#f4c0a8" /></linearGradient>
        </defs>
        <rect x="18" y="12" width="264" height="380" rx="26" fill="#eaf1f4" stroke="#d5e0e6" />
        {/* arms and legs, flexed newborn posture */}
        <path d="M104 150 Q72 150 66 150" stroke="#eec780" strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d="M196 150 Q228 150 234 150" stroke="#eec780" strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d="M124 286 Q92 300 98 344" stroke="#f4c0a8" strokeWidth="30" strokeLinecap="round" fill="none" />
        <path d="M176 286 Q208 300 202 344" stroke="#f4c0a8" strokeWidth="30" strokeLinecap="round" fill="none" />
        <g className="breathe" style={breathe}><ellipse cx="150" cy="206" rx="56" ry="74" fill="url(#jaundice)" /></g>
        <path d="M104 262 Q150 250 196 262 Q196 306 150 312 Q104 306 104 262Z" fill="#fff" stroke="#cfd9de" strokeWidth="2" />
        <circle cx="150" cy="78" r="50" fill="#ecc56f" />
        {back ? (
          <>
            <path d="M118 44 Q150 22 182 44" stroke="#7a5a3c" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".5" />
            <path d="M150 140 L150 258" stroke="#d8a85c" strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round" />
            <ellipse cx="150" cy="252" rx="20" ry="11" fill="#8f9bb0" opacity=".55" />
          </>
        ) : (
          <>
            <path d="M126 36 Q150 24 174 36" stroke="#7a5a3c" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".45" />
            <ellipse cx="132" cy="80" rx="8" ry="6" fill="#f3e3a0" /><ellipse cx="168" cy="80" rx="8" ry="6" fill="#f3e3a0" />
            <circle cx="132" cy="80" r="3.6" fill="#33312e" /><circle cx="168" cy="80" r="3.6" fill="#33312e" />
            <path d="M141 104 Q150 110 159 104" stroke="#a2513f" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="150" cy="238" r="3.5" fill="#b98a55" />
            {[[128, 178], [172, 196], [138, 214], [166, 168], [150, 190]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#d9705c" opacity=".7" />)}
          </>
        )}
      </g>
    );
  }
  return (
    <g>
      <rect x="18" y="8" width="264" height="400" rx="26" fill="#eaf1f4" stroke="#d5e0e6" />
      <path d="M96 128 Q66 200 62 296" stroke="#e7b792" strokeWidth="24" strokeLinecap="round" fill="none" />
      <path d="M204 128 Q234 200 238 296" stroke="#e7b792" strokeWidth="24" strokeLinecap="round" fill="none" />
      <path d="M128 300 L124 392" stroke="#e7b792" strokeWidth="32" strokeLinecap="round" fill="none" />
      <path d="M172 300 L176 392" stroke="#e7b792" strokeWidth="32" strokeLinecap="round" fill="none" />
      <rect x="138" y="80" width="24" height="34" rx="8" fill="#dfae88" />
      <g className="breathe" style={breathe}><path d="M92 124 Q150 104 208 124 L200 276 Q150 288 100 276Z" fill="#e7b792" /></g>
      <path d="M98 262 Q150 274 202 262 L206 328 Q176 334 152 318 L148 318 Q124 334 94 328Z" fill="#3f5b7a" />
      <ellipse cx="150" cy="52" rx="34" ry="38" fill="#e7b792" />
      <path d="M116 44 Q122 8 150 10 Q180 8 184 44 Q168 26 150 28 Q130 26 116 44Z" fill="#4a3a2e" />
      {back ? (
        <>
          <path d="M116 44 Q118 70 150 74 Q182 70 184 44Z" fill="#4a3a2e" />
          <path d="M150 116 L150 268" stroke="#c9976f" strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round" />
          <path d="M112 140 Q128 156 122 184" stroke="#c9976f" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M188 140 Q172 156 178 184" stroke="#c9976f" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="138" cy="52" r="3.4" fill="#33312e" /><circle cx="162" cy="52" r="3.4" fill="#33312e" />
          <ellipse cx="128" cy="64" rx="8" ry="5" fill="#d9705c" opacity=".5" /><ellipse cx="172" cy="64" rx="8" ry="5" fill="#d9705c" opacity=".5" />
          <path d="M142 73 Q150 76 158 73" stroke="#9c4a3a" strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="126" cy="150" r="2.4" fill="#b98463" /><circle cx="174" cy="150" r="2.4" fill="#b98463" /><circle cx="150" cy="244" r="2.6" fill="#b98463" />
        </>
      )}
    </g>
  );
}

type Result = { tool: Tool; where: string; items: number[]; note?: string; sound?: string };

export function ExamBoard({ patient, done, onDone }: { patient: Patient; done: number[]; onDone: (items: number[]) => void }) {
  const map = EXAM_MAPS[patient.id];
  const [tool, setTool] = useState<Tool>("look");
  const [back, setBack] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pulse, setPulse] = useState<{ x: number; y: number; n: number } | null>(null);
  const [sound, setSound] = useState(true);
  const [left, setLeft] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const spots = SPOTS[patient.id][back ? "back" : "front"];
  const keyLeft = useMemo(() => patient.exam.map((e, i) => ({ e, i })).filter(({ e, i }) => e.key && !done.includes(i)), [patient, done]);
  const keyTotal = patient.exam.filter((e) => e.key).length;

  useEffect(() => { if (result) card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [result]);

  const act = (t: Tool, region?: Region, at?: { x: number; y: number }) => {
    const rule = map.rules.find((r) => r.tool === t && (!r.at || (region && r.at.includes(region))));
    const where = region ? REGION_LABEL[region] : "";
    let heard: string | undefined;
    if (region && at) setPulse({ ...at, n: Date.now() });
    if (region) setUsed((u) => (u.includes(`${t}:${region}`) ? u : [...u, `${t}:${region}`]));
    if (t === "steth" && region) {
      const lung = region !== "heart" && region !== "abdomen";
      if (region === "heart") { heard = `Heart sounds at about ${map.sounds.hr}/min`; if (sound) playHeart(map.sounds.hr); }
      else if (lung) {
        const br = map.sounds.bronchial.includes(region), cr = map.sounds.crackles.includes(region);
        heard = br ? "Harsh, hollow breath sounds with crackles" : cr ? "Breath sounds with a few crackles" : "Soft, rustling breath sounds";
        if (sound) playBreath(map.sounds, br, cr);
      }
    }
    if (t === "percuss" && region) { const dull = map.sounds.dull.includes(region); heard = dull ? "Dull, short note" : "Resonant, hollow note"; if (sound) playPercuss(dull); }
    if (!rule) { setResult({ tool: t, where, items: [], note: "Nothing useful to find with this tool here. Try another tool or another place.", sound: heard }); return; }
    if (rule.items?.length) onDone(rule.items);
    setResult({ tool: t, where, items: rule.items ?? [], note: rule.note, sound: heard });
  };

  const pick = (t: Tool) => { setTool(t); if (TOOL_INFO[t].instant) act(t); else setResult(null); };
  const TIcon = ICON[tool];

  return (
    <div className="exam-board">
      <div className="exam-tools" role="toolbar" aria-label="Examination tools">
        {map.tools.map((t) => { const I = ICON[t]; return <button key={t} className={tool === t ? "on" : ""} aria-pressed={tool === t} onClick={() => pick(t)}><I size={20} /><span>{TOOL_INFO[t].label}</span></button>; })}
      </div>
      <p className="exam-hint"><TIcon size={15} /> {TOOL_INFO[tool].hint}</p>
      <div className="exam-stage">
        <svg viewBox="0 0 300 416" className={`exam-figure tool-${tool}`} role="group" aria-label={`${patient.name}, ${back ? "back" : "front"} view`}>
          <Figure kind={patient.id} back={back} rr={map.sounds.rr} />
          <text x="34" y="34" className="side-tag">{back ? "L" : "R"}</text><text x="256" y="34" className="side-tag">{back ? "R" : "L"}</text>
          {!TOOL_INFO[tool].instant && spots.map((s, i) => (
            <ellipse key={`${s.id}${i}`} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} className={`spot ${used.includes(`${tool}:${s.id}`) ? "used" : ""}`} tabIndex={0} role="button" aria-label={`${TOOL_INFO[tool].label}: ${REGION_LABEL[s.id]}`}
              onClick={() => act(tool, s.id, { x: s.x, y: s.y })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(tool, s.id, { x: s.x, y: s.y }); } }} />
          ))}
          {pulse && <circle key={pulse.n} cx={pulse.x} cy={pulse.y} r="10" className="spot-pulse" />}
        </svg>
        <div className="exam-side">
          <button className="reading-toggle" onClick={() => { setBack(!back); setPulse(null); }}><RefreshCw size={14} /> {back ? "Turn to front" : "Turn over (back)"}</button>
          {!TOOL_INFO[tool].instant && tool !== "percuss" && tool !== "steth" && tool !== "light" && <button className="reading-toggle" onClick={() => act(tool, "whole")}><TIcon size={14} /> {tool === "look" ? "Step back: whole patient" : tool === "reflex" ? "Lift and handle the baby" : "Handle the whole patient"}</button>}
          <button className="reading-toggle" aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound {sound ? "on" : "off"}</button>
          <button className="reading-toggle" aria-expanded={left} onClick={() => setLeft(!left)}><ListChecks size={14} /> {keyTotal - keyLeft.length}/{keyTotal} key steps</button>
          {left && (keyLeft.length ? <ul className="exam-left">{keyLeft.map(({ e, i }) => <li key={i}>{e.step}</li>)}</ul> : <p className="exam-left-done"><Check size={14} /> Every key step done. Commit to a diagnosis.</p>)}
        </div>
      </div>
      <div ref={card} aria-live="polite">
        {result && (
          <div className="exam-result">
            <b className="exam-result-head">{TOOL_INFO[result.tool].label}{result.where ? `: ${result.where}` : ""}</b>
            {result.sound && <p className="exam-sound"><span className="bars"><i /><i /><i /><i /><i /></span>{result.sound}</p>}
            {result.note && <p className="exam-note">{result.note}</p>}
            {result.items.map((i) => { const e = patient.exam[i]; return (
              <div key={i} className="ex-body flat"><p className="ex-step-name">{e.step}</p><p className="ex-how"><b>How</b>{e.how}</p><p className={`ex-find ${e.abnormal ? "abn" : ""}`}><b>{e.abnormal ? "Finding (abnormal)" : "Finding"}</b>{e.finding}</p></div>
            ); })}
          </div>
        )}
      </div>
    </div>
  );
}
