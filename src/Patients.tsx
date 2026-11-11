import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUp, Baby, Check, ClipboardList, Lightbulb, List, MessageCircle, Timer, RotateCcw, Search, Sparkles, Stethoscope, User, X } from "lucide-react";
import { PATIENTS, type Patient } from "./data/patients";
import { aiAvailable, streamChat, type ChatMsg } from "./ai";
import { ExamBoard } from "./Exam";

/** Everything the AI needs to play this patient. Items are numbered so its replies can be scored. */
function caseSheet(p: Patient): string {
  return [
    `Patient: ${p.name}, ${p.age} (${p.kind}).`,
    `History giver you play: ${p.who}.`,
    `Setting: ${p.intro}`,
    `Opening line (already said to the student): ${p.opening}`,
    "",
    "HISTORY ITEMS",
    ...p.history.map((h, i) => `H${i}${h.key ? " [key]" : ""} (${h.g}) Q: ${h.q} | A: ${h.a}`),
    "",
    "EXAMINATION STEPS",
    ...p.exam.map((e, i) => `E${i}${e.key ? " [key]" : ""} (${e.g}) ${e.step}: ${e.finding}${e.abnormal ? " (abnormal)" : ""}`),
    "",
    `Investigations, only if the student asks for a result: ${p.tests}`,
    `Diagnosis (never reveal or confirm): ${p.options[p.answer]}`,
  ].join("\n");
}

const TAG = /\[\[\s*H:([\d,\s]*)E:([\d,\s]*)\]\]/;
const visible = (t: string) => t.replace(/\s*\[\[[\s\S]*$/, "").replace(/\s*\[$/, "");
const nums = (t: string, max: number) => t.split(",").map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n >= 0 && n < max);

/* Two bedside patients: take the history by asking, examine step by step, then commit to a diagnosis. */

export function PatientsPage() {
  return (
    <div className="page-wrap">
      <header className="page-heading simple-heading">
        <div>
          <p className="eyebrow">BEDSIDE PRACTICE</p>
          <h1>Two patients.<br /><em>History, exam, diagnosis.</em></h1>
          <p className="lede">Ask the questions yourself, examine in order, then commit to a diagnosis. At the end you see which key questions and exam steps you missed, and how to present the case.</p>
        </div>
      </header>
      <div className="patient-grid">
        {PATIENTS.map((p) => (
          <Link key={p.id} href={`/patients/${p.id}`} className="patient-card">
            <span className="patient-avatar">{p.id === "neonate" ? <Baby size={30} /> : <User size={30} />}</span>
            <span className="patient-kind">{p.kind}</span>
            <b>{p.name}, {p.age}</b>
            <p>{p.intro}</p>
            <span className="patient-go">Start with {p.name} <ArrowRight size={16} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

type Tab = "history" | "exam" | "dx";

export function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const patient = PATIENTS.find((p) => p.id === id);
  if (!patient) return <div className="page-wrap"><p>No such patient.</p><Link href="/patients" className="button button-primary">Back</Link></div>;
  return <Encounter key={patient.id} patient={patient} />;
}

function Encounter({ patient }: { patient: Patient }) {
  const [tab, setTab] = useState<Tab>("history");
  const [asked, setAsked] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(patient.history[0].g);
  const chatEnd = useRef<HTMLDivElement>(null);
  const [ai, setAi] = useState(aiAvailable);
  const [talk, setTalk] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const sheet = useMemo(() => caseSheet(patient), [patient]);
  const [listView, setListView] = useState(false);
  /* 10-minute station clock: starts on the first action, stops when a diagnosis is committed. */
  const LIMIT = 600;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);
  const began = asked.length + done.length + talk.length > 0;
  useEffect(() => { if (began && startedAt === null) setStartedAt(Date.now()); }, [began, startedAt]);
  useEffect(() => {
    if (startedAt === null || picked !== null) return;
    const tick = () => setSecs(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, picked]);
  const remaining = LIMIT - secs;
  const clock = (n: number) => `${Math.floor(Math.abs(n) / 60)}:${String(Math.abs(n) % 60).padStart(2, "0")}`;

  const say = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const history: ChatMsg[] = [...talk, { role: "user", content }];
    setTalk([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setAiError("");
    setBusy(true);
    try {
      const full = await streamChat({ mode: "patient", messages: history, context: sheet }, (t) => setTalk([...history, { role: "assistant", content: t }]));
      const tag = TAG.exec(full);
      if (tag) {
        const h = nums(tag[1], patient.history.length), e = nums(tag[2], patient.exam.length);
        if (h.length) setAsked((a) => [...new Set([...a, ...h])]);
        if (e.length) setDone((d) => [...new Set([...d, ...e])]);
      }
    } catch (err) {
      setTalk(history.slice(0, -1));
      setDraft(content);
      setAiError(navigator.onLine ? (err as Error).message : "You are offline. Switch to Guided to keep practising.");
    } finally {
      setBusy(false);
    }
  };

  const hxGroups = useMemo(() => [...new Set(patient.history.map((h) => h.g))], [patient]);
  const exGroups = useMemo(() => [...new Set(patient.exam.map((e) => e.g))], [patient]);
  const keyHx = patient.history.filter((h) => h.key).length;
  const keyEx = patient.exam.filter((e) => e.key).length;
  const gotHx = asked.filter((i) => patient.history[i].key).length;
  const gotEx = done.filter((i) => patient.exam[i].key).length;

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [asked.length, talk]);

  const ask = (i: number) => { if (!asked.includes(i)) setAsked((a) => [...a, i]); };
  const q = query.trim().toLowerCase();
  const matches = q ? patient.history.map((h, i) => ({ h, i })).filter(({ h, i }) => !asked.includes(i) && q.split(/\s+/).every((w) => h.q.toLowerCase().includes(w))) : [];
  const reset = () => { setAsked([]); setDone([]); setPicked(null); setTab("history"); setQuery(""); setTalk([]); setAiError(""); setStartedAt(null); setSecs(0); window.scrollTo(0, 0); };

  return (
    <div className="page-wrap encounter">
      <Link href="/patients" className="back-link"><ArrowLeft size={16} /> Both patients</Link>
      <div className="enc-head">
        <span className="patient-avatar small">{patient.id === "neonate" ? <Baby size={22} /> : <User size={22} />}</span>
        <div><b>{patient.name}, {patient.age}</b><p>{patient.intro}</p></div>
        <span className={`enc-clock ${remaining <= 0 ? "over" : remaining <= 120 ? "low" : ""}`} aria-label="Time left"><Timer size={15} />{remaining >= 0 ? clock(remaining) : `+${clock(remaining)}`}</span>
      </div>
      {startedAt === null && <p className="enc-plan">10-minute station: about 4 min history, 4 min examination, 2 min diagnosis. The clock starts on your first move.</p>}
      {remaining <= 0 && picked === null && <p className="tutor-error">Time is up. Commit to your diagnosis now. <button className="text-link" onClick={() => { setTab("dx"); window.scrollTo(0, 0); }}>Go to Diagnosis</button></p>}
      {aiAvailable && (
        <div className="segmented enc-mode" role="group" aria-label="Practice mode">
          <button className={ai ? "on" : ""} aria-pressed={ai} onClick={() => setAi(true)}><Sparkles size={14} /> AI patient</button>
          <button className={!ai ? "on" : ""} aria-pressed={!ai} onClick={() => setAi(false)}>Guided</button>
        </div>
      )}
      <div className="enc-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}><MessageCircle size={16} /> History <i>{gotHx}/{keyHx}</i></button>
        <button role="tab" aria-selected={tab === "exam"} className={tab === "exam" ? "on" : ""} onClick={() => setTab("exam")}><Stethoscope size={16} /> Examine <i>{gotEx}/{keyEx}</i></button>
        <button role="tab" aria-selected={tab === "dx"} className={tab === "dx" ? "on" : ""} onClick={() => setTab("dx")}><ClipboardList size={16} /> Diagnosis</button>
      </div>

      {tab === "history" && ai && (
        <section>
          <p className="teaching-purpose">Type like you would at the bedside. Ask the {patient.id === "neonate" ? "mother" : "patient"} anything in your own words. Aim to be done in about 4 minutes, then examine.</p>
          <div className="chat tall" aria-live="polite">
            <div className="bubble them"><span>{patient.who}</span>{patient.opening}</div>
            {talk.map((m, i) => {
              if (m.role === "user") return <div key={i} className="bubble me">{m.content}</div>;
              const text = visible(m.content);
              const examiner = /^Examiner:/i.test(text);
              return <div key={i} className={`bubble them ${examiner ? "examiner" : ""}`}><span>{examiner ? "Examiner" : patient.who}</span>{text ? text.replace(/^Examiner:\s*/i, "") : <span className="typing"><i /><i /><i /></span>}</div>;
            })}
            <div ref={chatEnd} />
          </div>
          {aiError && <p className="tutor-error">{aiError} <button className="text-link" onClick={() => setAi(false)}>Use Guided mode</button></p>}
          <form className="tutor-input enc-input" onSubmit={(e) => { e.preventDefault(); say(draft); }}>
            <textarea rows={1} value={draft} placeholder="Ask a question or say what you examine" aria-label="Talk to the patient" enterKeyHint="send"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); say(draft); } }} />
            <button type="submit" className="tutor-send" aria-label="Send" disabled={busy || !draft.trim()}><ArrowUp size={18} /></button>
          </form>
          <div className="q-list"><button className="q-chip" disabled={busy} onClick={() => say("Examiner, can I have a hint about what I have not covered yet?")}><Lightbulb size={14} /> Hint</button></div>
          <div className="enc-next"><button className="button button-primary big" onClick={() => { setTab("exam"); window.scrollTo(0, 0); }}>Examine {patient.name} <ArrowRight size={17} /></button></div>
        </section>
      )}

      {tab === "history" && !ai && (
        <section>
          <div className="chat" aria-live="polite">
            <div className="bubble them"><span>{patient.who}</span>{patient.opening}</div>
            {asked.map((i) => (
              <div key={i} className="exchange">
                <div className="bubble me">{patient.history[i].q}</div>
                <div className="bubble them"><span>{patient.who}</span>{patient.history[i].a}{patient.history[i].why && <em>{patient.history[i].why}</em>}</div>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <label className="search-box ask-box"><Search size={17} /><input aria-label="Type a question" placeholder="Type what you want to ask, e.g. 'feeding' or 'allergies'" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { ask(matches[0].i); setQuery(""); } }} />{query && <button aria-label="Clear" onClick={() => setQuery("")}><X size={15} /></button>}</label>
          {q ? (
            <div className="q-list">
              {matches.length ? matches.slice(0, 6).map(({ h, i }) => <button key={i} className="q-chip" onClick={() => { ask(i); setQuery(""); }}>{h.q}</button>) : <p className="subtle-note">No unasked question matches. Try another word or open a section below.</p>}
            </div>
          ) : (
            <div className="q-groups">
              {hxGroups.map((g) => {
                const items = patient.history.map((h, i) => ({ h, i })).filter(({ h }) => h.g === g);
                const left = items.filter(({ i }) => !asked.includes(i)).length;
                const open = openGroup === g;
                return (
                  <div key={g} className={`q-group ${open ? "open" : ""}`}>
                    <button className="q-group-head" aria-expanded={open} onClick={() => setOpenGroup(open ? null : g)}><b>{g}</b><span>{left ? `${left} to ask` : "all asked"}</span></button>
                    {open && <div className="q-list">{items.map(({ h, i }) => <button key={i} className={`q-chip ${asked.includes(i) ? "asked" : ""}`} disabled={asked.includes(i)} onClick={() => ask(i)}>{asked.includes(i) && <Check size={14} />}{h.q}</button>)}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="enc-next"><button className="button button-primary big" onClick={() => { setTab("exam"); window.scrollTo(0, 0); }}>Go to examination <ArrowRight size={17} /></button></div>
        </section>
      )}

      {tab === "exam" && (
        <section>
          <div className="exam-top"><p className="teaching-purpose">Pick a tool, then tap {patient.name} where you would use it. Work in your usual order: look, feel, percuss, listen.</p><button className="reading-toggle" onClick={() => setListView(!listView)}><List size={14} /> {listView ? "Patient view" : "List view"}</button></div>
          {!listView && <ExamBoard patient={patient} done={done} onDone={(items) => setDone((d) => [...new Set([...d, ...items])])} />}
          {listView && exGroups.map((g) => (
            <div key={g} className="ex-group">
              <h3>{g}</h3>
              {patient.exam.map((e, i) => ({ e, i })).filter(({ e }) => e.g === g).map(({ e, i }) => {
                const open = done.includes(i);
                return (
                  <div key={i} className={`ex-step ${open ? "open" : ""}`}>
                    <button aria-expanded={open} onClick={() => setDone((d) => (d.includes(i) ? d : [...d, i]))}><span className="ex-ico">{open ? <Check size={15} /> : "+"}</span>{e.step}</button>
                    {open && <div className="ex-body"><p className="ex-how"><b>How</b>{e.how}</p><p className={`ex-find ${e.abnormal ? "abn" : ""}`}><b>{e.abnormal ? "Finding (abnormal)" : "Finding"}</b>{e.finding}</p></div>}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="enc-next"><button className="button button-primary big" onClick={() => { setTab("dx"); window.scrollTo(0, 0); }}>Commit to a diagnosis <ArrowRight size={17} /></button></div>
        </section>
      )}

      {tab === "dx" && (
        <section>
          <h3 className="dx-q">What is the most likely diagnosis?</h3>
          <div className="answer-options">
            {patient.options.map((o, i) => {
              const state = picked === null ? "" : i === patient.answer ? "right" : i === picked ? "wrong" : "dim";
              return <button key={o} className={`answer-option ${state}`} disabled={picked !== null} onClick={() => setPicked(i)}><span className="option-letter">{state === "right" ? <Check size={14} /> : state === "wrong" ? <X size={14} /> : String.fromCharCode(65 + i)}</span><span>{o}</span></button>;
            })}
          </div>
          {picked !== null && (
            <div className="debrief">
              <h3>{picked === patient.answer ? "Correct." : "Not this time."} {patient.options[patient.answer]}</h3>
              <div className="debrief-score"><span><b>{gotHx}/{keyHx}</b> key history questions</span><span><b>{gotEx}/{keyEx}</b> key exam steps</span>{startedAt !== null && <span><b>{clock(secs)}</b> {secs <= LIMIT ? "inside the 10 minutes" : "over the 10 minutes"}</span>}</div>
              <h4>Why</h4><ul>{patient.whyDx.map((w) => <li key={w}>{w}</li>)}</ul>
              <h4>Why not the others</h4><ul>{patient.notThis.map((n) => <li key={n.dx}><b>{n.dx}:</b> {n.why}</li>)}</ul>
              <h4>Labs and diagnostics</h4><p>{patient.tests}</p>
              <h4>Management plan</h4><p>{patient.manage}</p>
              <h4>How to present it</h4><p className="present">{patient.present}</p>
              {gotHx < keyHx && <><h4>Key history you did not ask</h4><ul className="missed">{patient.history.map((h, i) => ({ h, i })).filter(({ h, i }) => h.key && !asked.includes(i)).map(({ h, i }) => <li key={i}><b>{h.q}</b> {h.a}</li>)}</ul></>}
              {gotEx < keyEx && <><h4>Key exam steps you skipped</h4><ul className="missed">{patient.exam.map((e, i) => ({ e, i })).filter(({ e, i }) => e.key && !done.includes(i)).map(({ e, i }) => <li key={i}><b>{e.step}:</b> {e.finding}</li>)}</ul></>}
              <div className="enc-next"><button className="button button-outline" onClick={reset}><RotateCcw size={16} /> Start this patient again</button><Link href="/patients" className="button button-primary">Other patient <ArrowRight size={16} /></Link></div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
