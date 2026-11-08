import { useMemo, useState } from "react";
import courseData from "./data/course.json";
import { BLOCK_LABEL, DAY_LABEL, buildLesson, nextTopic } from "./course";
import { loadProgress, recordLesson, saveProgress } from "./progress";
import type { Course, Progress, Step, Topic } from "./types";

const course = courseData as Course;
const DAYS = ["sun", "mon", "tue", "wed"] as const;

type Screen =
  | { name: "path" }
  | { name: "notes"; topic: Topic }
  | { name: "lesson"; topic: Topic; repair: boolean };

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: "path" });
  const [scope, setScope] = useState<"notes" | "all">("notes");

  function commit(next: Progress) {
    saveProgress(next);
    setProgress(next);
  }

  const notes = course.topics.filter((topic) => topic.day);
  const active = scope === "notes" ? notes : course.topics;
  const upcoming = nextTopic(active, progress.completed);

  return (
    <div className="app">
      {screen.name === "path" && (
        <Path
          progress={progress}
          scope={scope}
          upcoming={upcoming}
          onScope={setScope}
          onStart={(topic) => setScreen({ name: "lesson", topic, repair: false })}
          onNotes={(topic) => setScreen({ name: "notes", topic })}
        />
      )}
      {screen.name === "notes" && <Notes topic={screen.topic} onClose={() => setScreen({ name: "path" })} />}
      {screen.name === "lesson" && (
        <Lesson
          topic={screen.topic}
          repair={screen.repair}
          attempt={progress.completed[screen.topic.id] ? 1 : 0}
          onClose={() => setScreen({ name: "path" })}
          onDone={(correct, total, missed) => {
            if (!screen.repair) commit(recordLesson(progress, screen.topic.id, correct, total, missed));
            setScreen({ name: "path" });
          }}
        />
      )}
    </div>
  );
}

function Path({
  progress,
  scope,
  upcoming,
  onScope,
  onStart,
  onNotes,
}: {
  progress: Progress;
  scope: "notes" | "all";
  upcoming?: Topic;
  onScope: (scope: "notes" | "all") => void;
  onStart: (topic: Topic) => void;
  onNotes: (topic: Topic) => void;
}) {
  const groups = scope === "notes"
    ? DAYS.map((day) => ({
        id: day,
        title: DAY_LABEL[day],
        detail: day === "sun" ? "Section I, the half you know" : "After your Anki reviews",
        topics: course.topics.filter((topic) => topic.day === day),
      }))
    : (["I", "II", "III"] as const).map((section) => ({
        id: section,
        title: `Section ${section}`,
        detail: "Every summary in your notes",
        topics: course.topics.filter((topic) => topic.section === section),
      }));

  return (
    <>
      <header className="top">
        <div className="stat flame"><span aria-hidden>▲</span><b>{progress.streak}</b></div>
        <div className="stat bolt"><span aria-hidden>✦</span><b>{progress.xp}</b></div>
        <div className="stat heart" style={{ marginLeft: "auto" }}><span aria-hidden>♥</span><b>5</b></div>
      </header>
      <div className="goal">
        <p>{progress.lessonsToday}/3 lessons today</p>
        <div className="track"><span style={{ width: `${Math.min(100, (progress.lessonsToday / 3) * 100)}%` }} /></div>
      </div>
      <div className="tabs">
        <button className={scope === "notes" ? "on" : ""} onClick={() => onScope("notes")}>Notes path</button>
        <button className={scope === "all" ? "on" : ""} onClick={() => onScope("all")}>All 165</button>
      </div>
      <main className="path">
        {upcoming && (
          <button className="check" onClick={() => onStart(upcoming)}>
            Start {upcoming.id}
          </button>
        )}
        {groups.map((group) => (
          <section key={group.id}>
            <div className="unit">
              <h2>{group.title}</h2>
              <p>{group.detail}</p>
            </div>
            {group.topics.map((topic, index) => {
              const done = progress.completed[topic.id];
              const soft = done ? done.correct / done.total < 0.8 : false;
              const isNext = upcoming?.id === topic.id;
              const side = index % 2 === 0 ? "left" : "right";
              return (
                <div className={`node-row ${side}`} key={topic.id}>
                  <div className={`node${done ? " done" : ""}${soft ? " soft" : ""}${isNext ? " next" : ""}`}>
                    <button className="bubble" onClick={() => onStart(topic)}>{done ? (soft ? "!" : "✓") : topic.n}</button>
                    <span className="name">
                      <button className="plain" onClick={() => onStart(topic)}>{topic.id} {topic.title}</button>
                      <small>
                        {done ? `${done.correct}/${done.total}` : "Start"}
                        {" · "}
                        <button className="plain" onClick={() => onNotes(topic)}>Notes</button>
                      </small>
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </main>
    </>
  );
}

function Notes({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const blocks = (["Def", "Cause", "Patho", "Signs", "Dx", "Rx"] as const).filter((name) => topic.blocks[name].length);
  return (
    <section className="sheet">
      <div className="sheet-top">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>{topic.id}</h2>
      </div>
      <p className="stem">{topic.title}</p>
      {blocks.map((name) => (
        <div key={name}>
          <h3>{name}</h3>
          <ul>
            {topic.blocks[name].map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Lesson({
  topic,
  repair,
  attempt,
  onClose,
  onDone,
}: {
  topic: Topic;
  repair: boolean;
  attempt: number;
  onClose: () => void;
  onDone: (correct: number, total: number, missed: { topicId: string; prompt: string; explain: string }[]) => void;
}) {
  const made = useMemo(() => buildLesson(topic, course, attempt), [topic, attempt]);
  const [steps, setSteps] = useState<Step[]>(made);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [hearts, setHearts] = useState(5);
  const [correct, setCorrect] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replayed, setReplayed] = useState<string[]>([]);
  const [missed, setMissed] = useState<{ topicId: string; prompt: string; explain: string }[]>([]);
  const [summary, setSummary] = useState<{ correct: number; total: number } | null>(null);

  const step = steps[index];
  const right = isRight(step, picked);
  const progress = steps.length ? index / steps.length : 0;

  function check() {
    if (!step || step.kind === "read" || checked || picked == null) return;
    setChecked(true);
    if (right) {
      setCorrect((count) => count + 1);
      return;
    }
    setHearts((count) => Math.max(0, count - 1));
    setMissed((items) => [...items, { topicId: topic.id, prompt: step.prompt, explain: explainOf(step) }]);
  }

  function continueOn() {
    if (!step) return;
    const base = step.id.replace(/-again$/, "");
    const replay = !right && step.kind !== "read" && !replayed.includes(base);
    const nextSteps = replay ? [...steps, { ...step, id: `${base}-again` }] : steps;
    if (replay) {
      setSteps(nextSteps);
      setReplayed((ids) => [...ids, base]);
    }
    if (!right && hearts <= 0 && !repair) {
      setPaused(true);
      return;
    }
    if (index + 1 >= nextSteps.length) {
      const total = nextSteps.filter((item) => item.kind !== "read").length;
      setSummary({ correct, total });
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setChecked(false);
  }

  if (summary) {
    const perfect = summary.total > 0 && summary.correct === summary.total;
    return (
      <section className="done">
        <h1>{perfect ? "Perfect" : "Lesson complete"}</h1>
        <p className="score">{summary.correct}/{summary.total}</p>
        <p>{perfect ? "20 XP" : "15 XP"}</p>
        <button className="check" onClick={() => onDone(summary.correct, summary.total, missed)}>Continue</button>
      </section>
    );
  }

  if (paused) {
    const last = missed[missed.length - 1];
    return (
      <section className="done">
        <h1 style={{ color: "#ea2b2b" }}>Out of hearts</h1>
        <p>Read the line, then the lesson continues.</p>
        {last && <div className="line">{last.explain}</div>}
        <button className="check" onClick={() => { setHearts(5); setPaused(false); continuePast(); }}>Continue</button>
        <button className="ghost" onClick={onClose}>End lesson</button>
      </section>
    );
  }

  function continuePast() {
    if (index + 1 >= steps.length) {
      const total = steps.filter((item) => item.kind !== "read").length;
      setSummary({ correct, total });
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setChecked(false);
  }

  if (!step) return null;

  return (
    <section className="lesson">
      <div className="lesson-top">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="bar"><span style={{ width: `${progress * 100}%` }} /></div>
        <div className="stat heart"><span aria-hidden>♥</span><b>{hearts}</b></div>
      </div>
      <p className="prompt">{step.prompt}</p>
      {step.kind === "read" && (
        <>
          <h1 className="stem">{step.lines.length === 1 ? BLOCK_LABEL[step.lines[0].source] : "Look at this first"}</h1>
          <div className="lines">
            {step.lines.map((line) => (
              <div className="line" key={line.text}><span>{BLOCK_LABEL[line.source]}</span>{line.text}</div>
            ))}
          </div>
          <p className="hint">Learn this line. The next card asks you to finish it.</p>
        </>
      )}
      {step.kind === "choice" && (
        <>
          <h1 className="stem choice-stem">{step.stem}</h1>
          <div className="options">
            {step.options.map((option, optionIndex) => {
              const selected = picked === option;
              const mark = checked && option === step.answer ? "good" : checked && selected ? "bad" : selected ? "on" : "";
              return (
                <button key={`${optionIndex}-${option}`} className={`option ${mark}`} disabled={checked} onClick={() => setPicked(option)}>
                  {option}
                </button>
              );
            })}
          </div>
        </>
      )}
      {step.kind === "bool" && (
        <>
          <h1 className="stem choice-stem">True for {step.prompt}?</h1>
          <div className="line">{step.statement}</div>
          <div className="options" style={{ marginTop: 12 }}>
            {["true", "false"].map((option) => {
              const selected = picked === option;
              const answer = step.answer ? "true" : "false";
              const mark = checked && option === answer ? "good" : checked && selected ? "bad" : selected ? "on" : "";
              return (
                <button key={option} className={`option ${mark}`} disabled={checked} onClick={() => setPicked(option)}>
                  {option === "true" ? "True" : "False"}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="spacer" />
      <footer className={`footer${checked ? (right ? " good" : " bad") : ""}`}>
        {checked && step.kind !== "read" && (
          <p>{right ? "Nice." : "Correct answer"} {!right && explainOf(step)}</p>
        )}
        {step.kind === "read" || checked ? (
          <button className="check" onClick={continueOn}>Continue</button>
        ) : (
          <button className="check" disabled={picked == null} onClick={check}>Check</button>
        )}
      </footer>
    </section>
  );
}

function isRight(step: Step | undefined, picked: string | null): boolean {
  if (!step || step.kind === "read") return true;
  if (step.kind === "bool") return picked === (step.answer ? "true" : "false");
  return picked === step.answer;
}

function explainOf(step: Step): string {
  if (step.kind === "read") return "";
  return step.explain;
}
