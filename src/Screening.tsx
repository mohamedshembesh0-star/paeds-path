import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Shuffle, Undo2 } from "lucide-react";
import { screening } from "./course";

/* The university's 100 screening questions as flip cards.
   "Again" sends the card to the back of the pile; "Right" removes it for good.
   Mouse: any click flips, then left click = again, right click = right. */

const KEY = "paeds-screening-v1";
type State = { queue: number[]; done: number[]; again: number };

const fresh = (shuffle: boolean): State => {
  const order = screening.map((_, i) => i);
  if (shuffle) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { queue: order, done: [], again: 0 };
};

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") as State | null;
    const ok = (a: unknown) => Array.isArray(a) && a.every((n) => Number.isInteger(n) && n >= 0 && n < screening.length);
    if (s && ok(s.queue) && ok(s.done) && s.queue.length + s.done.length === screening.length) return { ...s, again: Number(s.again) || 0 };
  } catch { /* start fresh */ }
  return fresh(false);
}

export function ScreeningPage() {
  const [state, setState] = useState<State>(load);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState<State[]>([]);
  const total = screening.length;
  const card = state.queue.length ? screening[state.queue[0]] : null;
  const number = useMemo(() => (card ? card.id.replace("S-", "") : ""), [card]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }, [state]);

  const grade = useCallback((right: boolean) => {
    setState((s) => {
      if (!s.queue.length) return s;
      setHistory((h) => [...h.slice(-30), s]);
      const [head, ...rest] = s.queue;
      return right ? { queue: rest, done: [...s.done, head], again: s.again } : { queue: [...rest, head], done: s.done, again: s.again + 1 };
    });
    setFlipped(false);
  }, []);
  const undo = useCallback(() => {
    setHistory((h) => { if (!h.length) return h; setState(h[h.length - 1]); setFlipped(false); return h.slice(0, -1); });
  }, []);
  const restart = (shuffle: boolean) => { setHistory([]); setState(fresh(shuffle)); setFlipped(false); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowRight" || e.key === "2") { e.preventDefault(); if (flipped) grade(true); else setFlipped(true); }
      else if (e.key === "ArrowLeft" || e.key === "1") { e.preventDefault(); if (flipped) grade(false); else setFlipped(true); }
      else if (e.key.toLowerCase() === "z" || e.key === "Backspace") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, grade, undo]);

  return (
    <div className="page-wrap flash-wrap">
      <header className="flash-head">
        <div><p className="eyebrow">SCREENING QUESTIONS</p><h2>{state.done.length} of {total} done</h2></div>
        <div className="flash-actions">
          <button className="reading-toggle" onClick={undo} disabled={!history.length}><Undo2 size={14} /> Undo</button>
          <button className="reading-toggle" onClick={() => restart(true)}><Shuffle size={14} /> Shuffle and restart</button>
          <button className="reading-toggle" onClick={() => restart(false)}><RotateCcw size={14} /> Restart in order</button>
        </div>
      </header>
      <div className="flash-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.done.length}><span style={{ width: `${(state.done.length / total) * 100}%` }} /></div>
      <p className="flash-meta">{state.queue.length} left in the pile · {state.again} sent back so far</p>

      {card ? (
        <>
          <div className={`flash-card ${flipped ? "flipped" : ""}`} role="button" tabIndex={0} aria-label={flipped ? "Answer. Left click again, right click right." : "Question. Click to show the answer."}
            onContextMenu={(e) => e.preventDefault()}
            onPointerUp={(e) => {
              if ((e.target as HTMLElement).closest("button, a")) return;
              if (e.pointerType === "mouse") {
                if (e.button !== 0 && e.button !== 2) return;
                if (!flipped) setFlipped(true); else grade(e.button === 2);
              } else setFlipped((f) => !f);
            }}>
            <div className="flash-inner" key={card.id}>
              <div className="flash-face flash-front"><span className="flash-n">Question {number}</span><p>{card.front}</p><small>Click to show the answer</small></div>
              <div className="flash-face flash-back"><span className="flash-n">Answer {number}</span><p>{card.back}</p>{card.caveat && <em>{card.caveat}</em>}<small className="mouse-only">Left click: again · Right click: right</small></div>
            </div>
          </div>
          <div className="flash-buttons">
            <button className="button flash-again" onClick={() => (flipped ? grade(false) : setFlipped(true))}><RotateCcw size={17} /> Again</button>
            <button className="button flash-right" onClick={() => (flipped ? grade(true) : setFlipped(true))}><Check size={17} /> Right</button>
          </div>
          <p className="flash-keys">Keyboard: Space flips · ← again · → right · Z undo</p>
        </>
      ) : (
        <div className="flash-done">
          <span className="flash-done-ico"><Check size={30} /></span>
          <h2>Khalas. All {total} done.</h2>
          <p>You sent {state.again} card{state.again === 1 ? "" : "s"} back along the way.</p>
          <div className="flash-buttons"><button className="button button-primary" onClick={() => restart(true)}><Shuffle size={16} /> Go again, shuffled</button><button className="button button-outline" onClick={() => restart(false)}>In order</button></div>
        </div>
      )}
    </div>
  );
}
