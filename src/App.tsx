import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, Route, Router, Switch, useLocation, useParams } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  Activity, ArrowLeft, Stethoscope, Rocket, BookOpenCheck, PenTool, Lightbulb, Printer, ScrollText, Gauge, ArrowRight, BookOpen, Brain, CalendarClock, Check, CheckCircle2, ChevronDown, Clipboard, Clock3, Download, Dumbbell, ExternalLink,
  Flame, GraduationCap, HeartPulse, Home, Layers3, ListChecks, Menu, Mic, Play, RotateCcw, Search, Settings, ShieldAlert, Shuffle, Sparkles, Target, Timer, Trophy, Upload, X, Zap,
} from "lucide-react";
import { BLOCKS, BLOCK_LABEL, SECTION_NAME, authoredTopics, bankFor, blitzSteps, checkCount, chunksFor, course, fastLessonSteps, hasChunks, lessonSteps, questionCount, studyOrder, topicById, topicLabel } from "./course";
import {
  accuracy, blockAccuracy, buildPlan, completeLesson, dayKey, dueItems, emptyProgress, fromTransferCode, gradeItem, loadProgress, mergeProgress, mixedDrill, nextDueAt,
  pace, parseImport, rapidFire, recordOral, saveProgress, sectionStats, toTransferCode, topicMastery, weakItems, DEFAULT_EXAM,
} from "./progress";
import { getTopicReferences } from "./references";
import { InkProvider, useInk, useInkScope } from "./Ink";
import { PatientPage, PatientsPage } from "./Patients";
import { Session, type SessionItem, type SessionResult } from "./Session";
import type { BlockName, Progress, Topic } from "./types";

/* ------------------------------------------------------------------ state */

type Store = {
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  replace: (p: Progress) => void;
};
const StoreContext = createContext<Store | null>(null);

function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Store missing");
  return value;
}

function StoreProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveProgress(progress);
  }, [progress]);
  // Another tab saved: pick it up.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "paeds-path-v2") setProgress(loadProgress());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const update = useCallback((fn: (p: Progress) => Progress) => setProgress((p) => fn(p)), []);
  const value = useMemo(() => ({ progress, update, replace: setProgress }), [progress, update]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Re-render every 30 s so due counts and countdowns stay live. */
function useTick(ms = 30_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/* ------------------------------------------------------------------ shell */

const navItems = [
  { href: "/", label: "Today", icon: Home },
  { href: "/topics", label: "Topics", icon: Layers3 },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/patients", label: "Patients", icon: Stethoscope },
  { href: "/cram", label: "Cram sheets", icon: ScrollText },
  { href: "/sketch", label: "Sketch pad", icon: PenTool },
  { href: "/oral", label: "Mock oral", icon: Mic },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];
const mobileNav = navItems.filter((n) => n.href !== "/settings" && n.href !== "/progress" && n.href !== "/oral" && n.href !== "/sketch");

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { progress } = useStore();
  useTick();
  const due = dueItems(progress).length;
  const plan = buildPlan(progress);
  const isActive = (href: string) => (href === "/" ? location === "/" : location.startsWith(href));
  return (
    <div className={`app-shell ${/^\/(learn|review|blitz|sprint)\//.test(location) ? "focus-mode" : ""}`}>
      <aside className="sidebar">
        <Link href="/" className="brand-lockup" aria-label="Paeds Path home">
          <span className="brand-mark"><Stethoscope size={21} strokeWidth={2.4} /></span>
          <span><b>paeds path</b><small>FINAL EXAM SPRINT</small></span>
        </Link>
        <div className="sidebar-label">YOUR DESK</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`}>
              <Icon size={18} /><span>{label}</span>
              {href === "/review" && due > 0 && <span className="nav-count">{due > 99 ? "99+" : due}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-mini">
            <span className="streak-icon"><CalendarClock size={17} /></span>
            <span><b>{examLabel(plan.examIn)}</b><small>{plan.learnedTotal}/{course.topics.length} topics learned</small></span>
          </div>
          <div className="disclaimer-side"><ShieldAlert size={15} /><span>Exam revision only. Not a clinical decision tool.</span></div>
        </div>
      </aside>
      <div className="mobile-top">
        <Link href="/" className="mobile-brand"><span className="brand-mark"><Stethoscope size={19} /></span><b>paeds path</b></Link>
        <span className="mobile-countdown"><CalendarClock size={14} /> {examLabel(plan.examIn)}</span>
        <button aria-label="Toggle navigation" className="icon-button" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {menuOpen && (
        <nav className="mobile-menu">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link onClick={() => setMenuOpen(false)} key={href} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`}><Icon size={18} />{label}</Link>
          ))}
        </nav>
      )}
      <main className="main-area">
        <div className="topline">
          <span>PAEDIATRICS FINAL / 165 TOPICS</span>
          <span className="topline-streak"><Flame size={15} /> {progress.streak} day streak · <Zap size={14} /> {progress.xp} xp</span>
        </div>
        {children}
        <footer className="site-footer"><ShieldAlert size={15} /><span>Built from your own notes for exam revision. Not for clinical decisions.</span></footer>
      </main>
      <nav className="mobile-bottom" aria-label="Mobile navigation">
        {mobileNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-label={label} className={`mobile-nav-item ${isActive(href) ? "active" : ""}`}>
            <span className="mobile-icon-wrap"><Icon size={19} />{href === "/review" && due > 0 && <i className="mobile-dot">{due > 99 ? "99+" : due}</i>}</span>
            <small>{label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function examLabel(examIn: number): string {
  if (examIn > 1) return `Exam in ${examIn} days`;
  if (examIn === 1) return "Exam tomorrow";
  if (examIn === 0) return "Exam day";
  return "Exam passed";
}

/* ------------------------------------------------------------------ today */

function HomePage() {
  const { progress } = useStore();
  useTick();
  const plan = buildPlan(progress);
  const due = dueItems(progress);
  const doneToday = plan.learnedToday >= plan.targetToday && plan.remaining > 0;
  const pct = Math.round((plan.learnedToday / Math.max(1, plan.targetToday)) * 100);
  const totalPct = Math.round((plan.learnedTotal / course.topics.length) * 100);
  const today = progress.days[dayKey()];
  const nextDue = nextDueAt(progress);
  const firstVisit = Object.keys(progress.topics).length === 0;
  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())} <span className="dot-sep">/</span> {examLabel(plan.examIn).toUpperCase()}</p>
          <h1>{plan.remaining === 0 ? <>Every topic learned.<br /><em>Now make it stick.</em></> : <>{plan.remaining} topics to go.<br /><em>{plan.daysLeft} day{plan.daysLeft === 1 ? "" : "s"} to do it.</em></>}</h1>
          <p className="lede">
            {plan.remaining === 0
              ? "Spend today on reviews, weak spots and mock orals."
              : `Tap Sprint all and keep going: one key-point card per topic, then one quick question per notes block. Topics rotate through Sections III, II and I, and every finished topic is saved, so you can stop and resume any time.`}
          </p>
        </div>
        <div className="heading-stats">
          <div className="stat-chip"><span className="stat-icon mint"><Target size={18} /></span><b>{plan.learnedToday}<small> / {plan.targetToday}</small></b><span>today's topics</span></div>
          <div className="stat-chip"><span className="stat-icon peach"><Sparkles size={18} /></span><b>{today ? Math.round((today.correct / Math.max(1, today.answered)) * 100) : 0}<small>%</small></b><span>today's accuracy</span></div>
        </div>
      </header>

      <section className="today-card">
        <div className="today-main">
          <div className="today-kicker"><span className="live-dot" /> {doneToday ? "TODAY'S TARGET DONE" : plan.remaining === 0 ? "CONSOLIDATE" : "NEXT TOPIC"}</div>
          {plan.next ? (
            <>
              <h2>{plan.next.title}</h2>
              <p>{topicLabel(plan.next)} · {SECTION_NAME[plan.next.section]}{plan.next.day ? " · not yet reviewed in Anki" : ""}</p>
            </>
          ) : (
            <>
              <h2>{due.length ? `${due.length} reviews are due.` : "Run a mock oral."}</h2>
              <p>Draw three topics, one per section, and talk through each one like it's the real exam.</p>
            </>
          )}
          <div className="today-actions">
            {plan.next ? (
              <>
                <Link className="button button-light" href="/sprint/all"><Rocket size={16} /> Sprint all {plan.remaining} remaining topics</Link>
                <Link className="button button-ghost-light" href="/sprint/6">6 at a time</Link>
                <Link className="button button-ghost-light" href="/blitz/5">Blitz 5 (full)</Link>
                <Link className="button button-ghost-light" href={`/learn/${plan.next.id}`}><Play size={16} /> {firstVisit ? "One topic at a time" : "Single lesson"}</Link>
              </>
            ) : <Link className="button button-light" href="/oral"><Mic size={16} /> Mock oral</Link>}
            {due.length > 0 && <Link className="button button-ghost-light" href="/review/due"><RotateCcw size={16} /> Relearn {due.length} due</Link>}
          </div>
          {plan.remaining > 0 && <PaceLine remaining={plan.remaining} />}
          <div className="today-meter">
            <div className="today-meter-track"><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
            <small>{plan.learnedToday} of {plan.targetToday} topics today</small>
          </div>
        </div>
        <div className="ecg" aria-hidden="true">
          <svg viewBox="0 0 600 120" preserveAspectRatio="none"><path className="ecg-line" pathLength="1" d="M0,70 L90,70 L105,70 L115,52 L125,70 L150,70 L162,70 L170,88 L182,12 L194,104 L204,70 L240,70 L258,50 L276,70 L330,70 L345,70 L355,52 L365,70 L390,70 L402,70 L410,88 L422,12 L434,104 L444,70 L480,70 L498,50 L516,70 L600,70" /></svg>
          <span className="ecg-heart"><HeartPulse size={26} /></span>
        </div>
      </section>

      <section className="action-grid">
        <Link href="/review/due" className={`action-card ${due.length ? "" : "muted"}`}>
          <span className="action-icon coral"><RotateCcw size={19} /></span>
          <b>{due.length} due</b>
          <span>Relearn round</span>
          <small>{due.length ? "Answer these before they fade." : nextDue ? `Next one due ${relTime(nextDue)}.` : "Nothing yet. Learn a topic first."}</small>
        </Link>
        <Link href="/review/rapid" className="action-card">
          <span className="action-icon gold"><Gauge size={19} /></span>
          <b>30 quick</b>
          <span>Rapid fire</span>
          <small>Fast single-fact questions from the topics you've learned. Correct answers move on by themselves.</small>
        </Link>
        <Link href="/review/weak" className="action-card">
          <span className="action-icon navy"><Dumbbell size={19} /></span>
          <b>{weakItems(progress).length} weak</b>
          <span>Weak spots</span>
          <small>Every question you've missed that isn't locked in yet, repeated until you get it.</small>
        </Link>
        <Link href="/oral" className="action-card">
          <span className="action-icon mint"><Mic size={19} /></span>
          <b>3 topics</b>
          <span>Mock oral</span>
          <small>Draw I + II + III and talk each one through: definition, causes, pathophysiology, clinical picture, diagnosis, treatment.</small>
        </Link>
      </section>

      <section className="path-progress">
        <div className="section-title-row">
          <div><p className="eyebrow">THE WHOLE SYLLABUS</p><h2>{plan.learnedTotal} of {course.topics.length} learned</h2></div>
          <Link className="text-link" href="/progress">Details <ArrowRight size={15} /></Link>
        </div>
        <div className="progress-track"><span style={{ width: `${totalPct}%` }} /></div>
        <div className="progress-caption"><span><b>{accuracy(progress)}%</b> first-try accuracy overall</span><span>{totalPct}% learned</span></div>
      </section>

      {plan.queueToday.length > 0 && (
        <section className="catalog-section">
          <div className="section-title-row"><div><p className="eyebrow">STILL TO LEARN TODAY</p><h2>Today's queue</h2><p className="section-sub">Topics you hadn't reviewed in Anki come first. You can still open any topic from the Topics tab.</p></div></div>
          <div className="topic-list">
            {plan.queueToday.map((topic, i) => <TopicRow key={topic.id} topic={topic} index={i} href={`/learn/${topic.id}`} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function relTime(ts: number): string {
  const mins = Math.round((ts - Date.now()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} d`;
}

function TopicRow({ topic, index, href }: { topic: Topic; index: number; href?: string }) {
  const { progress } = useStore();
  const learned = !!progress.topics[topic.id];
  const mastery = topicMastery(progress, topic.id);
  const status = !learned ? "unstarted" : mastery >= 75 ? "done" : "due";
  return (
    <Link href={href ?? `/topic/${topic.id}`} className={`topic-row ${status}`}>
      <span className="topic-index">{learned && mastery >= 75 ? <Check size={16} /> : String(index + 1).padStart(2, "0")}</span>
      <span className="topic-row-copy">
        <b>{topic.title}</b>
        <small>{topicLabel(topic)} <i>·</i> {learned ? `${mastery}% MASTERY` : topic.day ? "NOT IN ANKI YET" : "NOT STARTED"}</small>
      </span>
      {learned && <span className="mastery-pill" style={{ ["--m" as string]: `${mastery}%` }}><span /></span>}
      <ArrowRight size={16} className="row-arrow" />
    </Link>
  );
}

function readPref(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === "1"; } catch { return fallback; }
}
function writePref(key: string, v: boolean) {
  try { localStorage.setItem(key, v ? "1" : "0"); } catch { /* ignore */ }
}

function fmtDuration(secs: number): string {
  if (secs < 90) return `${Math.max(1, Math.round(secs))} s`;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function PaceLine({ remaining }: { remaining: number }) {
  const { progress } = useStore();
  const p = pace(progress);
  if (!p) return <p className="pace-line">Blitz mode runs topics back to back: a one-line key point, then quick questions. No reading cards, no stops between topics.</p>;
  return <p className="pace-line">Your pace is about {fmtDuration(p)} per topic, so the {remaining} remaining topics take roughly {fmtDuration(p * remaining)} of focused work.</p>;
}

/* ------------------------------------------------------------------ blitz */

/** Final sprint order: unlearned topics rotating Section III → II → I, so every section gets covered. */
function sprintOrder(progress: Progress): Topic[] {
  const by = (sec: Topic["section"]) => studyOrder.filter((t) => t.section === sec && !progress.topics[t.id]);
  const queues = [by("III"), by("II"), by("I")];
  const out: Topic[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  return out;
}

function BlitzPage({ sprint = false }: { sprint?: boolean }) {
  const { n, round } = useParams<{ n: string; round?: string }>();
  // "all" = every remaining topic in one continuous session.
  const all = n === "all";
  const size = all ? 1000 : Math.min(15, Math.max(1, Number(n) || (sprint ? 6 : 5)));
  const { progress, update } = useStore();
  const [, navigate] = useLocation();
  const base = sprint ? "/sprint" : "/blitz";
  const label = sprint ? "Final sprint" : "Blitz";
  // Freeze the topic list when the round starts.
  const topicIds = useMemo(() => (sprint ? sprintOrder(progress) : studyOrder.filter((t) => !progress.topics[t.id])).slice(0, size).map((t) => t.id), [size, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo<SessionItem[]>(() => {
    const out: SessionItem[] = [];
    for (const id of topicIds) {
      const steps = blitzSteps([id]).map((s) => (s.type === "teach" ? { ...s, step: topicIds.indexOf(id) + 1, steps: topicIds.length } : s));
      // Sprint: the key-point card plus one quick question per notes block (~1 min a topic).
      out.push(...(sprint ? [steps[0], ...chunksFor(id).map((c) => c.checks[0]).filter(Boolean)] : steps));
    }
    return out;
  }, [topicIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const perTopic = useRef<Record<string, { need: Set<string>; tried: Set<string>; right: number; done: boolean }>>({});
  const lastDone = useRef(Date.now());
  const [result, setResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    perTopic.current = {};
    for (const it of items) {
      if (it.type === "teach") continue;
      (perTopic.current[it.topicId] ??= { need: new Set(), tried: new Set(), right: 0, done: false }).need.add(it.id);
    }
    lastDone.current = Date.now();
  }, [items]);

  const onGrade = useCallback((id: string, correct: boolean, firstTry: boolean) => {
    update((p) => gradeItem(p, id, correct, firstTry, "lesson"));
    const tid = id.startsWith("S-") ? items.find((i) => i.id === id)?.topicId : id.slice(0, id.indexOf("-", id.indexOf("-") + 1));
    const t = tid ? perTopic.current[tid] : undefined;
    if (!t || t.done) return;
    if (firstTry) { t.tried.add(id); if (correct) t.right += 1; }
    if ([...t.need].every((x) => t.tried.has(x))) {
      // Topic finished: mark it learned now, so leaving the blitz early keeps it.
      t.done = true;
      const score = Math.round((t.right / Math.max(1, t.need.size)) * 100);
      const secs = (Date.now() - lastDone.current) / 1000;
      lastDone.current = Date.now();
      update((p) => completeLesson(p, tid!, score, secs));
    }
  }, [items, update]);

  const onFinish = useCallback((r: SessionResult) => { setResult(r); window.scrollTo(0, 0); }, []);

  if (!topicIds.length) {
    return <div className="page-wrap"><div className="empty-state empty-large"><div className="empty-illustration"><CheckCircle2 size={28} /></div><h2>Every topic is learned.</h2><p>Spend the rest of your time on reviews, rapid fire and mock orals.</p><Link href="/review" className="button button-primary">Go to reviews <ArrowRight size={17} /></Link></div></div>;
  }
  if (result) {
    const left = studyOrder.filter((t) => !progress.topics[t.id]).length;
    const nextLabel = all ? `Continue with all ${left} remaining` : sprint ? `Sprint the next ${Math.min(size, left)}` : `Blitz the next ${Math.min(size, left)}`;
    return (
      <ResultView
        title={`${label}: ${topicIds.length} topics done`}
        result={result}
        primary={left ? { label: nextLabel, href: `${base}/${all ? "all" : size}/${(Number(round) || 0) + 1}` } : { label: "Back to today", href: "/" }}
        secondary={[{ label: "Back to today", href: "/" }, { label: "Review what I missed", href: "/review/weak" }]}
        footnote={`${left} topics left. Come back for a Relearn round in a few hours: these questions return then and again tomorrow, which is what makes them stick.`}
      />
    );
  }
  const header = (
    <span className="session-header-row">
      <span>{label}: {all ? `all ${topicIds.length} remaining topics` : `${topicIds.length} topics`}</span>
      <span className="blitz-sizes">{(sprint ? [3, 6, 12] : [3, 5, 10]).map((k) => <Link key={k} className={!all && k === size ? "on" : ""} href={`${base}/${k}/${(Number(round) || 0) + 1}`}>{k}</Link>)}<Link className={all ? "on" : ""} href={`${base}/all/${(Number(round) || 0) + 1}`}>All</Link></span>
    </span>
  );
  return <Session key={`${base}-${size}-${round ?? 0}`} items={items} onGrade={onGrade} onFinish={onFinish} onExit={() => navigate("/")} header={header} />;
}

/* ------------------------------------------------------------------ topics */

type Filter = "all" | "new" | "weak" | "learned";

function TopicsPage() {
  const { progress } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = query.trim().toLowerCase();
  const matches = (topic: Topic) => {
    if (q && !`${topic.title} ${topicLabel(topic)}`.toLowerCase().includes(q)) return false;
    const learned = !!progress.topics[topic.id];
    if (filter === "new") return !learned;
    if (filter === "learned") return learned;
    if (filter === "weak") return learned && topicMastery(progress, topic.id) < 60;
    return true;
  };
  const sections = (["I", "II", "III"] as const).map((section) => ({ section, topics: course.topics.filter((t) => t.section === section && matches(t)) }));
  const count = sections.reduce((s, x) => s + x.topics.length, 0);
  return (
    <div className="page-wrap">
      <header className="page-heading simple-heading">
        <div><p className="eyebrow">THE SYLLABUS</p><h1>All 165<br /><em>topics.</em></h1><p className="lede">Open any topic to read your notes, its key point and the oral-exam prompts, or go straight into the lesson.</p></div>
      </header>
      <div className="filter-row">
        <label className="search-box"><Search size={17} /><input aria-label="Search topics" placeholder="Search, e.g. 'nephrotic' or 'III-14'" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
        <div className="segmented">
          {(["all", "new", "weak", "learned"] as Filter[]).map((f) => <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "new" ? "Not learned" : f === "weak" ? "Weak (<60%)" : "Learned"}</button>)}
        </div>
      </div>
      {sections.map(({ section, topics }) => topics.length > 0 && (
        <div className="section-group" key={section}>
          <div className="section-label"><span>SECTION {section}</span><b>{SECTION_NAME[section]}</b><small>{topics.length} topics</small></div>
          <div className="topic-list">{topics.map((topic) => <TopicRow key={topic.id} topic={topic} index={topic.n - 1} />)}</div>
        </div>
      ))}
      {count === 0 && <div className="empty-state"><Search size={25} /><h3>No topics match</h3><p>Try another search or filter.</p><button className="button button-outline" onClick={() => { setQuery(""); setFilter("all"); }}>Clear</button></div>}
    </div>
  );
}

/* ------------------------------------------------------------------ topic page (notes) */

function NotesBlocks({ topic, compact }: { topic: Topic; compact?: boolean }) {
  return (
    <div className={compact ? "notes-compact" : "notes-grid"}>
      {BLOCKS.filter((b) => topic.blocks[b].length).map((block, index) => (
        <section className="note-block" key={block}>
          <div className="note-block-heading">
            <span className="block-number">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{BLOCK_LABEL[block]}</h2></div>
          </div>
          <ul>{topic.blocks[block].map((line, i) => <li key={i}>{line}</li>)}</ul>
          {(() => {
            const c = chunksFor(topic.id).find((x) => x.block === block);
            return c && (c.explain || c.hook) ? (
              <div className="block-aids">
                {c.explain && <p className="teach-explain"><Lightbulb size={14} /> <span>{c.explain}</span></p>}
                {c.hook && <p className="teach-hook"><Sparkles size={14} /> <span>{c.hook}</span></p>}
              </div>
            ) : null;
          })()}
        </section>
      ))}
    </div>
  );
}

function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const topic = topicById.get(topicId);
  const { progress } = useStore();
  if (!topic) return <NotFound />;
  const bank = bankFor(topic.id);
  const learned = progress.topics[topic.id];
  const mastery = topicMastery(progress, topic.id);
  const refs = getTopicReferences(topic);
  return (
    <div className="page-wrap notes-page">
      <Link href="/topics" className="back-link"><ArrowLeft size={16} /> All topics</Link>
      <div className="notes-title">
        <p className="eyebrow">SECTION {topic.section} <span className="dot-sep">/</span> TOPIC {topic.n} <span className="dot-sep">/</span> {learned ? `${mastery}% MASTERY` : "NOT LEARNED YET"}</p>
        <h1>{topic.title}</h1>
        {bank.summary && <p className="pearl"><Sparkles size={16} /> {bank.summary}</p>}
        <div className="note-actions">
          <Link href={`/learn/${topic.id}`} className="button button-primary"><GraduationCap size={17} /> {learned ? "Redo lesson" : "Start lesson"}</Link>
          <span><ListChecks size={16} /> {bank.questions.length} questions · {bank.cards.length} oral drills</span>
        </div>
      </div>
      <NotesBlocks topic={topic} />
      {bank.cards.length > 0 && (
        <section className="synthesis-section">
          <div className="section-title-row"><div><p className="eyebrow">WHAT THE EXAMINER WILL ASK</p><h2>Oral prompts</h2><p className="section-sub">Answer out loud before you open each one.</p></div></div>
          <div className="synthesis-list">
            {bank.cards.map((card, i) => (
              <details className="synthesis-card" key={card.id}>
                <summary><span className="synthesis-number">{String(i + 1).padStart(2, "0")}</span><span className="synthesis-copy"><b>{card.front}</b></span><ChevronDown size={17} className="synthesis-chevron" /></summary>
                <ul>{card.back.split(/\s+•\s+/).map((line, j) => <li key={j}>{line}</li>)}</ul>
              </details>
            ))}
          </div>
        </section>
      )}
      <section className="references-section">
        <div className="section-title-row"><div><p className="eyebrow">IF SOMETHING LOOKS OFF</p><h2>Check a source</h2></div></div>
        <div className="reference-list">
          {refs.slice(0, 4).map((r) => (
            <a className="reference-card" href={r.url} key={`${r.organization}-${r.title}`} target="_blank" rel="noreferrer">
              <span className="reference-icon"><ExternalLink size={16} /></span>
              <span className="reference-copy"><b>{r.title}</b><small>{r.organization}</small></span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ lesson */

function LessonPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const topic = topicById.get(topicId);
  const { progress, update } = useStore();
  const [, navigate] = useLocation();
  const chunked = !!topic && hasChunks(topic.id);
  // Chunked lessons teach as they go, so they start straight away.
  const [phase, setPhase] = useState<"intro" | "quiz" | "deep" | "done">(chunked ? "quiz" : "intro");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [deepDone, setDeepDone] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [reading, setReading] = useState(() => readPref("paeds-reading-cards", false));
  const started = useRef(Date.now());

  useEffect(() => {
    setPhase(topic && hasChunks(topic.id) ? "quiz" : "intro");
    setResult(null);
    setDeepDone(false);
    window.scrollTo(0, 0);
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo<SessionItem[]>(() => {
    if (!topic) return [];
    const bank = bankFor(topic.id);
    if (hasChunks(topic.id)) return reading ? lessonSteps(topic.id) : fastLessonSteps(topic.id);
    const qs = [...bank.questions].sort((a, b) => a.level - b.level);
    return [...qs, ...bank.cards];
  }, [topic, runKey, reading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { started.current = Date.now(); }, [runKey, topicId, reading]);

  const deepItems = useMemo<SessionItem[]>(() => {
    if (!topic) return [];
    const bank = bankFor(topic.id);
    const used = new Set(items.map((q) => q.id));
    return [...bank.questions.filter((q) => !used.has(q.id)).sort((a, b) => a.level - b.level), ...bank.cards];
  }, [topic, items]);

  const onGrade = useCallback((id: string, correct: boolean, firstTry: boolean) => update((p) => gradeItem(p, id, correct, firstTry, "lesson")), [update]);
  const onFinish = useCallback(
    (r: SessionResult) => {
      if (!topic) return;
      const score = Math.round((r.firstTryCorrect / Math.max(1, r.total)) * 100);
      const secs = (Date.now() - started.current) / 1000;
      update((p) => completeLesson(p, topic.id, score, secs));
      setResult(r);
      setPhase("done");
      window.scrollTo(0, 0);
    },
    [topic, update],
  );
  const onDeepFinish = useCallback((r: SessionResult) => {
    setResult(r);
    setDeepDone(true);
    setPhase("done");
    window.scrollTo(0, 0);
  }, []);

  if (!topic) return <NotFound />;
  const bank = bankFor(topic.id);
  const header = `${topicLabel(topic)} · ${topic.title}`;

  if (phase === "quiz") {
    const sessionHeader = chunked ? (
      <span className="session-header-row">
        <span>{header}</span>
        <button className="reading-toggle" aria-pressed={reading} onClick={() => { const v = !reading; setReading(v); writePref("paeds-reading-cards", v); setRunKey((k) => k + 1); }}>
          <BookOpenCheck size={15} /> Reading cards {reading ? "on" : "off"}
        </button>
      </span>
    ) : header;
    return <Session key={`${topic.id}-${runKey}-${reading}`} items={items} onGrade={onGrade} onFinish={onFinish} onExit={() => navigate(`/topic/${topic.id}`)} header={sessionHeader} />;
  }
  if (phase === "deep") {
    return <Session key={`${topic.id}-deep-${runKey}`} items={deepItems} onGrade={onGrade} onFinish={onDeepFinish} onExit={() => setPhase("done")} header={`DEEP PRACTICE · ${header}`} />;
  }

  if (phase === "done" && result) {
    const plan = buildPlan(progress);
    const next = plan.next && plan.next.id !== topic.id ? plan.next : undefined;
    const secondary: { label: string; href?: string; onClick?: () => void }[] = [];
    if (chunked && !deepDone && deepItems.length) secondary.push({ label: `Deep practice (${deepItems.length} more)`, onClick: () => { setRunKey((k) => k + 1); setPhase("deep"); } });
    secondary.push({ label: "Redo lesson", onClick: () => { setRunKey((k) => k + 1); setDeepDone(false); setPhase("quiz"); } });
    secondary.push({ label: "Notes & cram sheet", href: `/topic/${topic.id}` });
    return (
      <ResultView
        title={deepDone ? `Deep practice · ${topic.title}` : topic.title}
        result={result}
        primary={next ? { label: `Next: ${next.title}`, href: `/learn/${next.id}` } : { label: "Back to today", href: "/" }}
        secondary={secondary}
        footnote={plan.remaining > 0 ? `${plan.learnedToday}/${plan.targetToday} topics today. Do a Relearn round in a few hours: today's questions come back then, and again tomorrow.` : "Every topic learned. Keep your review queue at zero."}
      />
    );
  }

  return (
    <div className="page-wrap lesson-wrap">
      <div className="lesson-top">
        <button className="icon-button" aria-label="Back" onClick={() => navigate("/")}><ArrowLeft size={18} /></button>
        <div className="lesson-progress"><div className="progress-track"><span style={{ width: "0%" }} /></div><span>0<i>/</i>{items.length}</span></div>
      </div>
      <div className="lesson-heading">
        <p className="eyebrow">{topicLabel(topic)} <span className="dot-sep">/</span> {SECTION_NAME[topic.section].toUpperCase()}</p>
        <h1>{topic.title}</h1>
        {bank.summary && <p className="pearl"><Sparkles size={16} /> {bank.summary}</p>}
      </div>
      <div className="teaching-card">
        <div className="teaching-card-heading">
          <span className="teaching-step-number"><BookOpen size={18} /></span>
          <div><p className="eyebrow">60-SECOND SCAN</p><h2>Your notes</h2></div>
        </div>
        <NotesBlocks topic={topic} compact />
      </div>
      <div className="sticky-start">
        <button className="button button-primary full-button big" onClick={() => setPhase("quiz")} autoFocus>
          <span><Play size={17} /> Start: {items.length} steps</span><ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ResultView({ title, result, primary, secondary, footnote }: { title: string; result: SessionResult; primary: { label: string; href: string }; secondary: { label: string; href?: string; onClick?: () => void }[]; footnote?: string }) {
  const score = Math.round((result.firstTryCorrect / Math.max(1, result.total)) * 100);
  const verdict = score >= 90 ? "Exam-ready." : score >= 70 ? "Solid. Polish the misses." : score >= 50 ? "Getting there." : "This one needs another pass.";
  const [, go] = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target as HTMLElement)?.closest?.("button, a, input, textarea")) { e.preventDefault(); go(primary.href); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary.href, go]);
  return (
    <div className="page-wrap">
      <div className="lesson-complete">
        {score >= 70 && <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ ["--x" as string]: `${(i * 53) % 100}%`, ["--d" as string]: `${(i % 6) * 0.12}s`, ["--r" as string]: `${(i * 47) % 360}deg`, ["--c" as string]: ["#94c5a6", "#f0aa7f", "#ffd76a", "#8fb8d8", "#e79ab0"][i % 5] }} />)}</div>}
        <div className="complete-seal">{score >= 70 ? <Trophy size={31} /> : <RotateCcw size={31} />}</div>
        <p className="eyebrow">{title.toUpperCase()}</p>
        <h1>{verdict}</h1>
        <div className="result-stats">
          <div><b>{score}%</b><span>first try</span></div>
          <div><b>+{result.xp}</b><span>xp</span></div>
          <div><b>{result.bestCombo}</b><span>best streak</span></div>
        </div>
        <div className="complete-buttons">
          <Link href={primary.href} className="button button-primary big" autoFocus>{primary.label} <ArrowRight size={17} /></Link>
        </div>
        <div className="complete-buttons secondary">
          {secondary.map((s) => (s.href ? <Link key={s.label} href={s.href} className="button button-outline">{s.label}</Link> : <button key={s.label} className="button button-outline" onClick={s.onClick}>{s.label}</button>))}
        </div>
        {footnote && <p className="review-note">{footnote}</p>}
      </div>
      {result.misses.length > 0 && (
        <section className="mistakes-section">
          <div className="section-title-row"><div><p className="eyebrow">LOOK AT THESE ONCE MORE</p><h2>What you missed</h2></div><span className="mistake-count">{result.misses.length}</span></div>
          <div className="mistake-list">
            {result.misses.map(({ item, chosen }) => (
              <div className="mistake-item" key={item.id}>
                <span className="mistake-mark">!</span>
                <div>
                  <b>{item.type === "mcq" ? item.stem : item.front}</b>
                  {item.type === "mcq" ? (
                    <>
                      {chosen && <p className="miss-chosen">You picked: {chosen}</p>}
                      <p className="miss-right">Answer: {item.options[item.answer]}</p>
                      <p>{item.explain}</p>
                    </>
                  ) : (
                    <p>{item.back}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ review */

function ReviewHub() {
  const { progress } = useStore();
  useTick();
  const due = dueItems(progress);
  const weak = weakItems(progress);
  const nextDue = nextDueAt(progress);
  const learned = Object.keys(progress.topics).length;
  return (
    <div className="page-wrap">
      <header className="page-heading simple-heading">
        <div><p className="eyebrow">SUCCESSIVE RELEARNING</p><h1>Relearn before<br /><em>it fades.</em></h1><p className="lede">The method with the strongest evidence for exam retention: answer questions with feedback, repeat misses until they're right, then do it again in later sessions. Here a question you get right comes back after 8 hours, then 1 day; a miss comes back in 10 minutes. Quick multiple-choice questions come first, so a round goes fast.</p></div>
        <div className="review-stat"><RotateCcw size={20} /><b>{due.length}</b><span>due now</span></div>
      </header>
      <section className="action-grid">
        <Link href="/review/rapid" className="action-card">
          <span className="action-icon mint"><Gauge size={19} /></span><b>30</b><span>Rapid fire</span>
          <small>Quick single-fact questions, auto-advancing. The fastest way to run through a lot of facts.</small>
        </Link>
        <Link href="/review/due" className={`action-card ${due.length ? "" : "muted"}`}>
          <span className="action-icon coral"><RotateCcw size={19} /></span><b>{due.length} due</b><span>Relearn round</span>
          <small>{due.length ? `Up to 25 per round, newest misses first.` : nextDue ? `All clear. Next one due ${relTime(nextDue)}.` : "Learn a topic to fill this up."}</small>
        </Link>
        <Link href="/review/weak" className={`action-card ${weak.length ? "" : "muted"}`}>
          <span className="action-icon gold"><Dumbbell size={19} /></span><b>{weak.length} weak</b><span>Weak spots</span>
          <small>Every question you've missed that isn't locked in yet, whether or not it's due.</small>
        </Link>
        <Link href="/review/mixed" className={`action-card ${learned ? "" : "muted"}`}>
          <span className="action-icon navy"><Shuffle size={19} /></span><b>20</b><span>Mixed drill</span>
          <small>Interleaved questions from {learned ? `your ${learned} learned topics` : "the whole syllabus"}, weighted toward weak ones.</small>
        </Link>
      </section>
      {due.length > 0 && (
        <section className="catalog-section">
          <div className="section-title-row"><div><p className="eyebrow">WHERE THE DUE ITEMS COME FROM</p><h2>By topic</h2></div></div>
          <div className="chip-cloud">
            {Object.entries(due.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.topicId]: (acc[item.topicId] ?? 0) + 1 }), {}))
              .sort((a, b) => b[1] - a[1])
              .slice(0, 24)
              .map(([id, n]) => { const t = topicById.get(id)!; return <Link key={id} href={`/topic/${id}`} className="topic-chip">{topicLabel(t)} {t.title.length > 34 ? `${t.title.slice(0, 32)}…` : t.title} <b>{n}</b></Link>; })}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewSession() {
  const { mode, round: roundParam } = useParams<{ mode: string; round?: string }>();
  const { progress, update } = useStore();
  const [, navigate] = useLocation();
  const round = Number(roundParam ?? 0) || 0;
  const [result, setResult] = useState<SessionResult | null>(null);
  // Freeze the item list at the start of each round.
  const items = useMemo<SessionItem[]>(() => {
    if (mode === "due") return dueItems(progress).slice(0, 30);
    if (mode === "weak") return weakItems(progress).slice(0, 20);
    if (mode === "rapid") return rapidFire(progress, 30);
    if (mode === "rapid-I" || mode === "rapid-II" || mode === "rapid-III") return rapidFire(progress, 30, mode.slice(6) as Topic["section"]);
    return mixedDrill(progress, 20);
  }, [mode, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const onGrade = useCallback((id: string, correct: boolean, firstTry: boolean) => update((p) => gradeItem(p, id, correct, firstTry, "review")), [update]);
  const onFinish = useCallback((r: SessionResult) => { setResult(r); window.scrollTo(0, 0); }, []);
  const title = mode === "due" ? "Relearn round" : mode === "weak" ? "Weak-spot drill" : mode.startsWith("rapid") ? "Rapid fire" : "Mixed drill";

  if (result) {
    const moreDue = dueItems(progress).length;
    const moreWeak = weakItems(progress).length;
    const more = mode === "due" ? moreDue : mode === "weak" ? moreWeak : 1;
    return (
      <ResultView
        title={title}
        result={result}
        primary={more > 0 ? { label: mode === "due" ? `Keep going (${moreDue} due)` : mode === "weak" ? `Another round (${moreWeak} weak)` : mode.startsWith("rapid") ? "Another 30" : "Another 20", href: `/review/${mode}/${round + 1}` } : { label: "Back to today", href: "/" }}
        secondary={[{ label: "Review hub", href: "/review" }]}
      />
    );
  }
  if (!items.length) {
    return (
      <div className="page-wrap">
        <div className="empty-state empty-large">
          <div className="empty-illustration"><CheckCircle2 size={28} /></div>
          <p className="eyebrow">NOTHING HERE RIGHT NOW</p>
          <h2>{mode === "due" ? "No reviews due." : mode === "weak" ? "No weak spots left." : "Nothing to drill yet."}</h2>
          <p>{mode === "due" ? "Learn the next topic. Its questions will join this queue on schedule." : "Keep learning topics and this fills up automatically."}</p>
          <Link href="/" className="button button-primary">Back to today <ArrowRight size={17} /></Link>
        </div>
      </div>
    );
  }
  return <Session key={`${mode}-${round}`} items={items} showTopic onGrade={onGrade} onFinish={onFinish} onExit={() => navigate("/review")} header={title.toUpperCase()} />;
}

function BlitzRoute() {
  const [location] = useLocation();
  return <BlitzPage key={location} sprint={location.startsWith("/sprint")} />;
}

/** Remount on every round so each one starts fresh. */
function ReviewSessionRoute() {
  const [location] = useLocation();
  return <ReviewSession key={location} />;
}

/* ------------------------------------------------------------------ sketch pad */

const SHEETS = 8;

function SketchPage() {
  const ink = useInk();
  const [sheet, setSheet] = useState(() => {
    try { return Number(localStorage.getItem("paeds-sketch-sheet")) || 1; } catch { return 1; }
  });
  useInkScope(`sketch:${sheet}`);
  useEffect(() => {
    ink?.setActive(true);
    return () => ink?.setActive(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { localStorage.setItem("paeds-sketch-sheet", String(sheet)); } catch { /* ignore */ }
  }, [sheet]);
  return (
    <div className="page-wrap sketch-page">
      <header className="sketch-head">
        <div><h1>Sketch pad</h1><p className="lede">Blank sheets for drawing out pathways, algorithms and mnemonics. Pencil or mouse draws; your finger scrolls.</p></div>
        <div className="segmented sheet-tabs" role="tablist" aria-label="Sheets">
          {Array.from({ length: SHEETS }, (_, i) => i + 1).map((n) => <button key={n} role="tab" aria-selected={sheet === n} className={sheet === n ? "on" : ""} onClick={() => setSheet(n)}>Sheet {n}</button>)}
        </div>
      </header>
      <div className="sketch-paper" aria-label={`Sheet ${sheet}`} />
    </div>
  );
}

/* ------------------------------------------------------------------ cram sheets */

function CramPage() {
  const { progress } = useStore();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"all" | Topic["section"]>("all");
  const [onlyWeak, setOnlyWeak] = useState(false);
  const q = query.trim().toLowerCase();
  const topics = course.topics.filter((t) => {
    if (section !== "all" && t.section !== section) return false;
    if (onlyWeak && !(progress.topics[t.id] && topicMastery(progress, t.id) < 60)) return false;
    if (!q) return true;
    const text = `${topicLabel(t)} ${t.title} ${BLOCKS.map((b) => t.blocks[b].join(" ")).join(" ")}`.toLowerCase();
    return text.includes(q);
  });
  return (
    <div className="page-wrap cram-page">
      <header className="page-heading simple-heading">
        <div><p className="eyebrow">CRAM MODE</p><h1>Every topic<br /><em>on one screen.</em></h1><p className="lede">The key point, your notes and a memory hook for every block, topic after topic. Scroll it the night before, or print a section.</p></div>
      </header>
      <div className="filter-row no-print">
        <label className="search-box"><Search size={17} /><input aria-label="Search cram sheets" placeholder="Search any fact, e.g. 'ceftriaxone'" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
        <div className="segmented">{(["all", "I", "II", "III"] as const).map((x) => <button key={x} className={section === x ? "on" : ""} onClick={() => setSection(x)}>{x === "all" ? "All" : `Section ${x}`}</button>)}</div>
        <div className="segmented"><button className={onlyWeak ? "on" : ""} onClick={() => setOnlyWeak(!onlyWeak)}>Only weak</button></div>
        <button className="button button-outline" onClick={() => window.print()}><Printer size={15} /> Print</button>
        {!offline && <a className="button button-primary" href="/paeds-path-trees.pdf" download><Download size={15} /> Tree diagrams PDF</a>}
        {section !== "all" && <Link className="button button-outline" href={`/review/rapid-${section}`}><Gauge size={15} /> Rapid fire section {section}</Link>}
      </div>
      <p className="subtle-note no-print">{topics.length} topics</p>
      <div className="cram-list">
        {topics.map((t) => {
          const chunks = chunksFor(t.id);
          const bank = bankFor(t.id);
          return (
            <article className="cram-topic" key={t.id}>
              <header>
                <span>{topicLabel(t)}</span>
                <Link href={`/topic/${t.id}`}><h2>{t.title}</h2></Link>
                {progress.topics[t.id] && <i>{topicMastery(progress, t.id)}%</i>}
              </header>
              {bank.summary && <p className="cram-pearl">{bank.summary}</p>}
              <div className="cram-blocks">
                {BLOCKS.filter((b) => t.blocks[b].length).map((b) => {
                  const c = chunks.find((x) => x.block === b);
                  return (
                    <div className="cram-block" key={b}>
                      <b>{BLOCK_LABEL[b]}</b>
                      <ul>{t.blocks[b].map((l, i) => <li key={i}>{l}</li>)}</ul>
                      {c?.hook && <p className="cram-hook"><Sparkles size={12} /> {c.hook}</p>}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ mock oral */

type OralTopic = { topic: Topic; covered: Record<BlockName, boolean>; seconds: number };

function drawOral(progress: Progress): Topic[] {
  return (["I", "II", "III"] as const).map((section) => {
    const pool = course.topics.filter((t) => t.section === section);
    // Bias toward learned-but-weak topics, but anything can come up, just like the real draw.
    const weighted = pool.map((t) => ({ t, w: progress.topics[t.id] ? 1 + (100 - topicMastery(progress, t.id)) / 25 : 1.5 }));
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) return x.t;
    }
    return pool[pool.length - 1];
  });
}

function OralPage() {
  const { progress, update } = useStore();
  const [drawn, setDrawn] = useState<OralTopic[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [limit, setLimit] = useState(5);
  const [start, setStart] = useState<number>(0);
  const [, force] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!drawn || revealed || finished) return;
    const id = window.setInterval(() => force((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, [drawn, revealed, finished]);

  const begin = (topics?: Topic[]) => {
    const list = (topics ?? drawOral(progress)).map((topic) => ({ topic, covered: { Def: false, Cause: false, Patho: false, Signs: false, Dx: false, Rx: false }, seconds: 0 }));
    setDrawn(list);
    setIndex(0);
    setRevealed(false);
    setFinished(false);
    setStart(Date.now());
  };

  if (!drawn) {
    return (
      <div className="page-wrap">
        <header className="page-heading simple-heading">
          <div><p className="eyebrow">EXAM SIMULATION</p><h1>Draw three.<br /><em>Talk it through.</em></h1><p className="lede">One topic from each section, like the real draw. For each one, answer out loud in exam order (definition, causes, pathophysiology, clinical picture, diagnosis, treatment) before the timer runs out. Then reveal your notes and tick what you actually covered. Anything you left out goes straight back into your review queue.</p></div>
        </header>
        <div className="oral-setup">
          <div className="segmented">
            {[3, 5, 8].map((m) => <button key={m} className={limit === m ? "on" : ""} onClick={() => setLimit(m)}>{m} min / topic</button>)}
          </div>
          <button className="button button-primary big" onClick={() => begin()}><Shuffle size={17} /> Draw my three topics</button>
        </div>
        <div className="oral-history">
          <p className="eyebrow">LAST ORAL SCORES</p>
          {Object.entries(progress.topics).filter(([, t]) => t.oral !== undefined).length === 0 ? <p className="subtle-note">No mock orals yet.</p> : (
            <div className="chip-cloud">
              {Object.entries(progress.topics).filter(([, t]) => t.oral !== undefined).sort((a, b) => b[1].lastAt - a[1].lastAt).slice(0, 18).map(([id, t]) => { const topic = topicById.get(id)!; return <Link key={id} href={`/topic/${id}`} className={`topic-chip ${t.oral! >= 5 ? "ok" : t.oral! >= 3 ? "" : "bad"}`}>{topicLabel(topic)} {topic.title.length > 30 ? `${topic.title.slice(0, 28)}…` : topic.title} <b>{t.oral}/6</b></Link>; })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (finished) {
    const total = drawn.reduce((s, d) => s + BLOCKS.filter((b) => d.covered[b]).length, 0);
    return (
      <div className="page-wrap">
        <div className="lesson-complete">
          <div className="complete-seal"><Mic size={31} /></div>
          <p className="eyebrow">MOCK ORAL COMPLETE</p>
          <h1>{total}/18 blocks covered</h1>
          <div className="oral-summary">
            {drawn.map((d) => (
              <Link key={d.topic.id} href={`/topic/${d.topic.id}`} className="oral-summary-row">
                <span>{topicLabel(d.topic)}</span><b>{d.topic.title}</b>
                <i>{BLOCKS.filter((b) => d.covered[b]).length}/6</i>
              </Link>
            ))}
          </div>
          <div className="complete-buttons"><button className="button button-primary big" onClick={() => begin()}><Shuffle size={17} /> Draw again</button><Link className="button button-outline" href="/review/due">Review what I missed</Link></div>
        </div>
      </div>
    );
  }

  const current = drawn[index];
  const elapsed = Math.floor((Date.now() - start) / 1000);
  const remaining = limit * 60 - elapsed;
  const bank = bankFor(current.topic.id);
  const toggle = (b: BlockName) => setDrawn(drawn.map((d, i) => (i === index ? { ...d, covered: { ...d.covered, [b]: !d.covered[b] } } : d)));
  const next = () => {
    const missed = BLOCKS.filter((b) => !current.covered[b] && current.topic.blocks[b].length);
    const score = BLOCKS.filter((b) => current.covered[b]).length;
    update((p) => recordOral(p, current.topic.id, missed, score));
    if (index + 1 >= drawn.length) setFinished(true);
    else {
      setIndex(index + 1);
      setRevealed(false);
      setStart(Date.now());
      window.scrollTo(0, 0);
    }
  };
  return (
    <div className="page-wrap lesson-wrap">
      <div className="lesson-top">
        <button className="icon-button" aria-label="Quit mock oral" onClick={() => setDrawn(null)}><X size={18} /></button>
        <div className="oral-steps">{drawn.map((d, i) => <span key={d.topic.id} className={i < index ? "done" : i === index ? "on" : ""}>{d.topic.section}</span>)}</div>
        <span className={`timer-chip ${!revealed && remaining < 30 ? "warn" : ""}`}><Timer size={15} /> {revealed ? "stopped" : remaining >= 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : `+${Math.floor(-remaining / 60)}:${String(-remaining % 60).padStart(2, "0")}`}</span>
      </div>
      <div className="lesson-heading">
        <p className="eyebrow">SECTION {current.topic.section} · TOPIC {current.topic.n} · {SECTION_NAME[current.topic.section].toUpperCase()}</p>
        <h1>{current.topic.title}</h1>
      </div>
      {!revealed ? (
        <div className="teaching-card">
          <p className="teaching-purpose big">Talk for {limit} minutes. Go in order:</p>
          <ol className="oral-order">{BLOCKS.map((b) => <li key={b}>{BLOCK_LABEL[b]}</li>)}</ol>
          <p className="teaching-purpose">If you blank, start with the definition and a classification, then the most dangerous cause and its emergency treatment. Examiners reward structure.</p>
          <button className="button button-primary full-button big" onClick={() => setRevealed(true)}><span><BookOpen size={17} /> Done — show my notes</span><ArrowRight size={18} /></button>
        </div>
      ) : (
        <>
          <p className="teaching-purpose">Tick each block you actually said clearly. Be strict: anything you leave unticked goes back into review.</p>
          <div className="oral-blocks">
            {BLOCKS.filter((b) => current.topic.blocks[b].length).map((b) => (
              <button key={b} className={`oral-block ${current.covered[b] ? "on" : ""}`} onClick={() => toggle(b)}>
                <span className="oral-check">{current.covered[b] ? <Check size={15} /> : null}</span>
                <span className="oral-block-copy"><b>{BLOCK_LABEL[b]}</b><ul>{current.topic.blocks[b].map((l, i) => <li key={i}>{l}</li>)}</ul></span>
              </button>
            ))}
          </div>
          {bank.cards.length > 0 && (
            <details className="synthesis-card oral-followups">
              <summary><span className="synthesis-number"><Brain size={14} /></span><span className="synthesis-copy"><b>Likely follow-up questions</b><small>What the examiner asks next</small></span><ChevronDown size={17} className="synthesis-chevron" /></summary>
              <ul>{bank.cards.map((c) => <li key={c.id}><b>{c.front}</b><br />{c.back}</li>)}</ul>
            </details>
          )}
          <div className="sticky-start">
            <button className="button button-primary full-button big" onClick={next}><span>{index + 1 >= drawn.length ? "Finish mock oral" : "Next topic"}</span><ArrowRight size={18} /></button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ progress */

function ProgressPage() {
  const { progress } = useStore();
  const plan = buildPlan(progress);
  const blocks = blockAccuracy(progress);
  const days = Object.entries(progress.days).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  const weakTopics = Object.keys(progress.topics).map((id) => ({ id, m: topicMastery(progress, id) })).sort((a, b) => a.m - b.m).slice(0, 8);
  return (
    <div className="page-wrap">
      <header className="page-heading simple-heading">
        <div><p className="eyebrow">WHERE YOU STAND</p><h1>Progress.<br /><em>Honestly.</em></h1><p className="lede">Mastery counts how many of a topic's questions have survived spaced review. A question only reaches full marks after you've answered it correctly across several days, not just once.</p></div>
        <div className="progress-badge"><Trophy size={26} /><b>{progress.xp}</b><span>xp</span></div>
      </header>
      <div className="metric-grid">
        <div className="metric-card"><span className="metric-icon mint"><Layers3 size={19} /></span><div><b>{plan.learnedTotal}<small> / {course.topics.length}</small></b><span>topics learned</span></div><div className="mini-track"><span style={{ width: `${(plan.learnedTotal / course.topics.length) * 100}%` }} /></div></div>
        <div className="metric-card"><span className="metric-icon peach"><Target size={19} /></span><div><b>{accuracy(progress)}<small>%</small></b><span>first-try accuracy</span></div><small>Across {Object.values(progress.items).reduce((s, x) => s + x.seen, 0)} answers</small></div>
        <div className="metric-card"><span className="metric-icon gold"><Flame size={19} /></span><div><b>{progress.streak}</b><span>day streak</span></div><small>{examLabel(plan.examIn)}</small></div>
      </div>

      <section className="mastery-section">
        <div className="section-title-row"><div><p className="eyebrow">BY SECTION</p><h2>Coverage & mastery</h2></div></div>
        {(["I", "II", "III"] as const).map((section) => {
          const s = sectionStats(progress, section);
          const topics = course.topics.filter((t) => t.section === section);
          return (
            <div className="mastery-row" key={section}>
              <div className="mastery-name"><span>SECTION {section}</span><b>{SECTION_NAME[section]}</b></div>
              <div className="mastery-bars">{topics.map((t) => { const m = topicMastery(progress, t.id); return <Link href={`/topic/${t.id}`} key={t.id} title={`${topicLabel(t)} ${t.title}: ${progress.topics[t.id] ? `${m}%` : "not learned"}`} className={progress.topics[t.id] ? "filled" : ""} style={progress.topics[t.id] ? { opacity: 0.35 + (m / 100) * 0.65 } : undefined} />; })}</div>
              <div className="mastery-count">{s.learned}<small>/{s.total}</small></div>
              <div className="mastery-percent">{s.mastery}%</div>
            </div>
          );
        })}
      </section>

      <section className="mastery-section">
        <div className="section-title-row"><div><p className="eyebrow">BY NOTES BLOCK</p><h2>Which part of the answer is weakest?</h2></div></div>
        <div className="block-bars">
          {BLOCKS.map((b) => {
            const { right, wrong } = blocks[b];
            const pct = right + wrong ? Math.round((right / (right + wrong)) * 100) : 0;
            return <div className="block-bar" key={b}><span>{BLOCK_LABEL[b]}</span><div className="progress-track"><span style={{ width: `${pct}%`, background: pct < 60 ? "#c0735b" : pct < 80 ? "#c9a25e" : undefined }} /></div><b>{right + wrong ? `${pct}%` : "–"}</b></div>;
          })}
        </div>
      </section>

      {weakTopics.length > 0 && (
        <section className="catalog-section">
          <div className="section-title-row"><div><p className="eyebrow">LOWEST MASTERY</p><h2>Topics to revisit</h2></div></div>
          <div className="topic-list">{weakTopics.map(({ id }, i) => <TopicRow key={id} topic={topicById.get(id)!} index={i} />)}</div>
        </section>
      )}

      {days.length > 0 && (
        <section className="mastery-section">
          <div className="section-title-row"><div><p className="eyebrow">DAILY LOG</p><h2>Last days</h2></div></div>
          <div className="day-log">
            {days.map(([key, d]) => <div key={key}><span>{key}</span><b>{d.topics} topics</b><b>{d.answered} answers</b><b>{d.answered ? Math.round((d.correct / d.answered) * 100) : 0}%</b><b>+{d.xp} xp</b></div>)}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ settings */

function SettingsPage() {
  const { progress, replace, update } = useStore();
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pasted, setPasted] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const download = () => {
    const blob = new Blob([JSON.stringify(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paeds-path-progress-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Progress file downloaded.");
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseImport(await file.text());
    if (!parsed) return setMessage("That file isn't a Paeds Path progress file.");
    replace(mergeProgress(progress, parsed));
    setMessage("Imported and merged with this device's progress.");
  };
  const makeCode = async () => {
    const c = await toTransferCode(progress);
    setCode(c);
    try {
      await navigator.clipboard.writeText(c);
      setMessage(`Transfer code copied (${Math.round(c.length / 1024)} KB). Paste it on your other device.`);
    } catch {
      setMessage("Code generated below. Select it and copy it manually.");
    }
  };
  const useCode = async () => {
    const parsed = await fromTransferCode(pasted);
    if (!parsed) return setMessage("That code didn't work. Make sure you pasted the whole thing.");
    replace(mergeProgress(progress, parsed));
    setPasted("");
    setMessage("Progress merged from the other device.");
  };

  return (
    <div className="page-wrap settings-page">
      <header className="page-heading simple-heading">
        <div><p className="eyebrow">SETTINGS</p><h1>Your exam,<br /><em>your data.</em></h1><p className="lede">Progress saves automatically in this browser. To move between phone and laptop, use a transfer code or a progress file. Importing merges, so you never lose work from either device.</p></div>
      </header>
      {message && <div className="inline-message"><span>{message}</span><button onClick={() => setMessage(null)} aria-label="Dismiss"><X size={15} /></button></div>}

      <section className="settings-card">
        <span className="settings-icon"><CalendarClock size={20} /></span>
        <div className="settings-copy">
          <p className="eyebrow">THE PLAN</p><h2>Exam date</h2>
          <p>Today's target is your unlearned topics divided evenly over the days left before this date.</p>
          <div className="settings-actions">
            <input className="date-input" type="date" value={progress.examDate} onChange={(e) => e.target.value && update((p) => ({ ...p, examDate: e.target.value, updatedAt: Date.now() }))} />
            {progress.examDate !== DEFAULT_EXAM && <button className="button button-outline" onClick={() => update((p) => ({ ...p, examDate: DEFAULT_EXAM }))}>Reset to {DEFAULT_EXAM}</button>}
          </div>
        </div>
      </section>

      <section className="settings-card">
        <span className="settings-icon"><Clipboard size={20} /></span>
        <div className="settings-copy">
          <p className="eyebrow">MOVE BETWEEN DEVICES</p><h2>Transfer code</h2>
          <p>Copy a code here, send it to yourself (notes app, WhatsApp, email), then paste it on the other device. Both devices' progress gets merged.</p>
          <div className="settings-actions"><button className="button button-primary" onClick={makeCode}><Clipboard size={16} /> Copy transfer code</button></div>
          {code && <textarea className="code-box" readOnly value={code} onFocus={(e) => e.currentTarget.select()} />}
          <textarea className="code-box" placeholder="Paste a code from your other device here…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <div className="settings-actions"><button className="button button-outline" disabled={!pasted.trim()} onClick={useCode}>Merge pasted code</button></div>
        </div>
      </section>

      <section className="settings-card">
        <span className="settings-icon"><Download size={20} /></span>
        <div className="settings-copy">
          <p className="eyebrow">BACKUP</p><h2>Progress file (JSON)</h2>
          <p>Download a backup, or import a file from another browser. Importing merges with what's already here.</p>
          <div className="settings-actions">
            <button className="button button-primary" onClick={download}><Download size={16} /> Download</button>
            <label className="button button-outline import-label"><Upload size={16} /> Import file<input type="file" accept="application/json,.json" onChange={importFile} /></label>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <span className="settings-icon"><HeartPulse size={20} /></span>
        <div className="settings-copy">
          <p className="eyebrow">ABOUT THE CONTENT</p><h2>{questionCount} questions across {authoredTopics} topics</h2>
          <p>Lessons now teach one block at a time with {checkCount} quick single-fact checks, then 3 vignettes; Deep practice holds the rest. Every question is written from your 165 one-page summaries and keyed to the exact line it tests (shown after you answer). Where a line of your notes is debatable, the explanation says so. Shortcuts: keys 1–4 or A–D pick an answer, Enter continues, Space reveals an oral drill.</p>
        </div>
      </section>

      <div className="danger-zone">
        <div><p className="eyebrow">DANGER ZONE</p><h2>Reset all progress</h2><p>Deletes every score and schedule in this browser. Download a backup first.</p></div>
        {confirmReset ? (
          <div className="reset-confirm"><b>Really delete everything?</b><button className="button button-danger" onClick={() => { replace(emptyProgress()); setConfirmReset(false); setMessage("Progress reset."); }}>Yes, reset</button><button className="button button-outline" onClick={() => setConfirmReset(false)}>Cancel</button></div>
        ) : (
          <button className="button button-outline danger-outline" onClick={() => setConfirmReset(true)}>Reset progress</button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

function NotFound() {
  return (
    <div className="page-wrap not-found">
      <span className="not-found-code">404</span>
      <h1>Not on the syllabus.</h1>
      <p className="lede">That page doesn't exist.</p>
      <Link href="/" className="button button-primary">Back to today <ArrowRight size={17} /></Link>
    </div>
  );
}

function ScrollTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

/** Opened straight from disk (the offline Mac copy): use #/ links so every page works without a server. */
const offline = typeof window !== "undefined" && window.location.protocol === "file:";

export default function App() {
  return (
    <Router hook={offline ? useHashLocation : undefined}>
    <InkProvider>
    <StoreProvider>
      <ScrollTop />
      <AppShell>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/topics" component={TopicsPage} />
          <Route path="/topic/:topicId" component={TopicPage} />
          <Route path="/learn/:topicId" component={LessonPage} />
          <Route path="/blitz/:n/:round?" component={BlitzRoute} />
          <Route path="/sprint/:n/:round?" component={BlitzRoute} />
          <Route path="/review" component={ReviewHub} />
          <Route path="/review/:mode/:round?" component={ReviewSessionRoute} />
          <Route path="/patients" component={PatientsPage} />
          <Route path="/patients/:id" component={PatientPage} />
          <Route path="/cram" component={CramPage} />
          <Route path="/sketch" component={SketchPage} />
          <Route path="/oral" component={OralPage} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </StoreProvider>
    </InkProvider>
    </Router>
  );
}

// Keep the full study order importable for debugging in the console.
export { studyOrder, Clock3 };
