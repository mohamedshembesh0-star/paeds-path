import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Baby, Check, ClipboardList, MessageCircle, RotateCcw, Search, Stethoscope, User, X } from "lucide-react";
import { PATIENTS, type Patient } from "./data/patients";

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

  const hxGroups = useMemo(() => [...new Set(patient.history.map((h) => h.g))], [patient]);
  const exGroups = useMemo(() => [...new Set(patient.exam.map((e) => e.g))], [patient]);
  const keyHx = patient.history.filter((h) => h.key).length;
  const keyEx = patient.exam.filter((e) => e.key).length;
  const gotHx = asked.filter((i) => patient.history[i].key).length;
  const gotEx = done.filter((i) => patient.exam[i].key).length;

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [asked.length]);

  const ask = (i: number) => { if (!asked.includes(i)) setAsked((a) => [...a, i]); };
  const q = query.trim().toLowerCase();
  const matches = q ? patient.history.map((h, i) => ({ h, i })).filter(({ h, i }) => !asked.includes(i) && q.split(/\s+/).every((w) => h.q.toLowerCase().includes(w))) : [];
  const reset = () => { setAsked([]); setDone([]); setPicked(null); setTab("history"); setQuery(""); window.scrollTo(0, 0); };

  return (
    <div className="page-wrap encounter">
      <Link href="/patients" className="back-link"><ArrowLeft size={16} /> Both patients</Link>
      <div className="enc-head">
        <span className="patient-avatar small">{patient.id === "neonate" ? <Baby size={22} /> : <User size={22} />}</span>
        <div><b>{patient.name}, {patient.age}</b><p>{patient.intro}</p></div>
      </div>
      <div className="enc-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}><MessageCircle size={16} /> History <i>{gotHx}/{keyHx}</i></button>
        <button role="tab" aria-selected={tab === "exam"} className={tab === "exam" ? "on" : ""} onClick={() => setTab("exam")}><Stethoscope size={16} /> Examination <i>{gotEx}/{keyEx}</i></button>
        <button role="tab" aria-selected={tab === "dx"} className={tab === "dx" ? "on" : ""} onClick={() => setTab("dx")}><ClipboardList size={16} /> Diagnosis</button>
      </div>

      {tab === "history" && (
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
          <p className="teaching-purpose">Tap each step in the order you would do it. You get the technique and what you find.</p>
          {exGroups.map((g) => (
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
              <div className="debrief-score"><span><b>{gotHx}/{keyHx}</b> key history questions</span><span><b>{gotEx}/{keyEx}</b> key exam steps</span></div>
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
