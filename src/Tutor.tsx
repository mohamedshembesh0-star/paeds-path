import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUp, Download, Maximize2, RotateCcw, Sparkles, Square, Trash2, X } from "lucide-react";
import { aiAvailable, screenText, streamChat, type ChatMsg } from "./ai";

/* Side tutor: a chat panel that can see the page the student is on. */

/* Diagrams arrive as a HyperFrames composition (HTML + a paused GSAP timeline) inside a ```hyperframe block.
   They run in a sandboxed iframe with a tiny player: fit to the frame, play the timeline, replay on request. */
const PLAYER = `<script>(function(){
function root(){return document.querySelector('[data-composition-id]')}
function fit(){var r=root();if(!r)return;var w=+r.dataset.width||r.offsetWidth||1080,h=+r.dataset.height||r.offsetHeight||1080;var s=Math.min(innerWidth/w,innerHeight/h);document.documentElement.style.overflow='hidden';document.body.style.margin='0';r.style.position='absolute';r.style.transformOrigin='0 0';r.style.transform='scale('+s+')';r.style.left=(innerWidth-w*s)/2+'px';r.style.top=(innerHeight-h*s)/2+'px'}
function tl(){var t=window.__timelines||{},r=root();return(r&&t[r.dataset.compositionId])||Object.values(t)[0]}
function start(){fit();var t=tl();if(t)t.play(0)}
addEventListener('resize',fit);
addEventListener('message',function(e){var t=tl();if(t&&e.data==='replay')t.restart()});
if(document.readyState==='complete')start();else addEventListener('load',start);
})();</` + `script>`;

const withPlayer = (html: string) => (/<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${PLAYER}</body>`) : html + PLAYER);

type Part = { kind: "text"; text: string } | { kind: "diagram"; html: string } | { kind: "drawing" };

function parts(content: string): Part[] {
  const out: Part[] = [];
  const re = /```(?:hyperframe|html)[^\n]*\n([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) out.push({ kind: "text", text: content.slice(last, m.index) });
    out.push({ kind: "diagram", html: m[1] });
    last = re.lastIndex;
  }
  let rest = content.slice(last);
  const open = rest.search(/```(?:hyperframe|html)?/);
  if (open >= 0) { out.push({ kind: "text", text: rest.slice(0, open) }); out.push({ kind: "drawing" }); rest = ""; }
  if (rest.trim()) out.push({ kind: "text", text: rest.replace(/`{1,2}$/, "") });
  return out.filter((p) => p.kind !== "text" || p.text.trim());
}

/** What goes back to the model as history: the diagram code is replaced by a short marker. */
const forHistory = (m: ChatMsg): ChatMsg => (m.role === "assistant" ? { ...m, content: m.content.replace(/```(?:hyperframe|html)[\s\S]*?(```|$)/g, "[diagram shown to the student]") } : m);

function Diagram({ html }: { html: string }) {
  const [big, setBig] = useState(false);
  const [run, setRun] = useState(0);
  const doc = withPlayer(html);
  const save = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = "diagram.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const frame = <iframe key={`${run}-${big}`} title="Diagram" sandbox="allow-scripts" srcDoc={doc} />;
  const tools = (
    <div className="diagram-tools">
      <button onClick={() => setRun((n) => n + 1)}><RotateCcw size={14} /> Replay</button>
      {big ? <button onClick={() => setBig(false)}><X size={14} /> Close</button> : <button onClick={() => setBig(true)}><Maximize2 size={14} /> Enlarge</button>}
      <button onClick={save}><Download size={14} /> Save</button>
    </div>
  );
  if (big) return <div className="diagram-full" role="dialog" aria-label="Diagram">{frame}{tools}</div>;
  return <div className="diagram">{frame}{tools}</div>;
}

const STARTERS = [
  "Draw me a diagram of this",
  "Explain what is on my screen, short",
  "Quiz me on this with MCQs",
  "Give me the 5 highest-yield facts here",
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
      await streamChat({ mode: "tutor", messages: history.map(forHistory), context }, (full) => setMsgs([...history, { role: "assistant", content: full }]), ctl.signal);
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
                <p>Ask anything about what you are studying, or ask for a diagram. Short answers, exam focus.</p>
                {STARTERS.map((s) => <button key={s} className="q-chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              m.role === "user" ? <div key={i} className="bubble me">{m.content}</div> : !m.content ? <div key={i} className="bubble them"><span className="typing"><i /><i /><i /></span></div> : parts(m.content).map((p, j) => (
                p.kind === "diagram" ? <Diagram key={`${i}-${j}`} html={p.html} />
                : p.kind === "drawing" ? <div key={`${i}-${j}`} className="bubble them drawing"><span className="typing"><i /><i /><i /></span> Drawing your diagram. This takes up to a minute.</div>
                : <div key={`${i}-${j}`} className="bubble them">{p.text.trim()}</div>
              ))
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
