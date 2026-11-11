import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUp, Sparkles, Square, Trash2, X } from "lucide-react";
import { aiAvailable, screenText, streamChat, type ChatMsg } from "./ai";

/* Side tutor: a chat panel that can see the page the student is on. */

const STARTERS = [
  "Explain what is on my screen, short",
  "Quiz me on this with MCQs",
  "Give me the 5 highest-yield facts here",
  "What is the classic exam trap here?",
];

export function Tutor() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [location] = useLocation();
  const opened = useRef("");
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!aiAvailable) return null;

  const show = () => {
    opened.current = screenText();
    setOpen(true);
    setTimeout(() => input.current?.focus(), 60);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const now = screenText();
    const context = opened.current && opened.current !== now
      ? `Page: ${location}\n\n[On screen when the student opened the tutor]\n${opened.current}\n\n[On screen now]\n${now}`
      : `Page: ${location}\n\n${now}`;
    const history: ChatMsg[] = [...msgs, { role: "user", content }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError("");
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      await streamChat({ mode: "tutor", messages: history, context }, (full) => setMsgs([...history, { role: "assistant", content: full }]), ctl.signal);
    } catch (e) {
      if (ctl.signal.aborted) {
        setMsgs((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
      } else {
        setMsgs(history.slice(0, -1));
        setDraft(content);
        setError(navigator.onLine ? (e as Error).message : "You are offline. The tutor needs a connection.");
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <>
      {!open && <button className="tutor-fab" aria-label="Open the AI tutor" onClick={show}><Sparkles size={20} /></button>}
      {open && (
        <aside className="tutor-panel" role="dialog" aria-label="AI tutor">
          <header>
            <span className="tutor-mark"><Sparkles size={16} /></span>
            <div><b>Tutor</b><small>Sees the page you are on</small></div>
            {msgs.length > 0 && <button className="icon-button" aria-label="Clear chat" onClick={() => { abort.current?.abort(); setMsgs([]); setError(""); }}><Trash2 size={17} /></button>}
            <button className="icon-button" aria-label="Close tutor" onClick={() => setOpen(false)}><X size={19} /></button>
          </header>
          <div className="tutor-body" aria-live="polite">
            {msgs.length === 0 && (
              <div className="tutor-empty">
                <p>Ask anything about what you are studying. Short answers, exam focus.</p>
                {STARTERS.map((s) => <button key={s} className="q-chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "user" ? "me" : "them"}`}>
                {m.content || <span className="typing"><i /><i /><i /></span>}
              </div>
            ))}
            {error && <p className="tutor-error">{error}</p>}
            <div ref={end} />
          </div>
          <form className="tutor-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <textarea ref={input} rows={1} value={draft} placeholder="Ask the tutor" aria-label="Message the tutor" enterKeyHint="send"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }} />
            {busy
              ? <button type="button" className="tutor-send" aria-label="Stop" onClick={() => abort.current?.abort()}><Square size={15} /></button>
              : <button type="submit" className="tutor-send" aria-label="Send" disabled={!draft.trim()}><ArrowUp size={18} /></button>}
          </form>
        </aside>
      )}
    </>
  );
}
