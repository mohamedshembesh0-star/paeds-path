import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Flame, RotateCcw, X, Zap } from "lucide-react";
import { BLOCK_LABEL, topicById, topicLabel } from "./course";
import type { Card, Mcq } from "./types";

export type SessionItem = Mcq | Card;
export type Miss = { item: SessionItem; chosen?: string };
export type SessionResult = { total: number; firstTryCorrect: number; xp: number; misses: Miss[]; bestCombo: number };

type Entry = { item: SessionItem; retry: number; order: number[] };

const LEVEL_NAME = { 1: "CORE", 2: "APPLIED", 3: "HARD" } as const;

function shuffledOrder(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function entryFor(item: SessionItem, retry = 0): Entry {
  return { item, retry, order: item.type === "mcq" ? shuffledOrder(item.options.length) : [] };
}

type Props = {
  items: SessionItem[];
  showTopic?: boolean;
  onGrade: (itemId: string, correct: boolean, firstTry: boolean) => void;
  onFinish: (result: SessionResult) => void;
  onExit: () => void;
  header?: string;
};

export function Session({ items, showTopic, onGrade, onFinish, onExit, header }: Props) {
  const [queue, setQueue] = useState<Entry[]>(() => items.map((item) => entryFor(item)));
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // index into original options
  const [revealed, setRevealed] = useState(false); // for cards
  const [cardVerdict, setCardVerdict] = useState<boolean | null>(null);
  const attempted = useRef(new Set<string>());
  const firstRight = useRef(new Set<string>());
  const misses = useRef<Map<string, Miss>>(new Map());
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const bestCombo = useRef(0);
  const finished = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);

  const entry = queue[pos];
  const uniqueTotal = items.length;
  const [doneUnique, setDoneUnique] = useState(0);
  const doneIds = useRef(new Set<string>());

  const answered = entry?.item.type === "mcq" ? picked !== null : cardVerdict !== null;

  const grade = useCallback(
    (correct: boolean, chosen?: string) => {
      if (!entry) return;
      const id = entry.item.id;
      const firstTry = !attempted.current.has(id);
      attempted.current.add(id);
      if (firstTry && correct) firstRight.current.add(id);
      if (!correct && !misses.current.has(id)) misses.current.set(id, { item: entry.item, chosen });
      onGrade(id, correct, firstTry);
      if (correct && !doneIds.current.has(id)) {
        doneIds.current.add(id);
        setDoneUnique(doneIds.current.size);
      }
      if (correct) {
        setXp((v) => v + (firstTry ? 10 : 4));
        setCombo((c) => {
          const next = c + 1;
          bestCombo.current = Math.max(bestCombo.current, next);
          return next;
        });
      } else {
        setCombo(0);
        if (entry.retry < 3) setQueue((q) => [...q, entryFor(entry.item, entry.retry + 1)]);
      }
    },
    [entry, onGrade],
  );

  const choose = useCallback(
    (optionIndex: number) => {
      if (!entry || entry.item.type !== "mcq" || picked !== null) return;
      setPicked(optionIndex);
      grade(optionIndex === entry.item.answer, entry.item.options[optionIndex]);
    },
    [entry, picked, grade],
  );

  const judgeCard = useCallback(
    (good: boolean) => {
      if (!entry || entry.item.type !== "card" || cardVerdict !== null) return;
      setCardVerdict(good);
      grade(good);
    },
    [entry, cardVerdict, grade],
  );

  const advance = useCallback(() => {
    if (!answered) return;
    setPicked(null);
    setRevealed(false);
    setCardVerdict(null);
    setPos((p) => p + 1);
  }, [answered]);

  // Finish when we run off the end of the queue.
  useEffect(() => {
    if (pos >= queue.length && !finished.current) {
      finished.current = true;
      onFinish({ total: uniqueTotal, firstTryCorrect: firstRight.current.size, xp, misses: [...misses.current.values()], bestCombo: bestCombo.current });
    }
  }, [pos, queue.length, onFinish, uniqueTotal, xp]);

  // Bring the explanation into view on small screens.
  useEffect(() => {
    if (picked !== null) barRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [picked]);

  // Card verdict auto-advances so recall drilling stays fast.
  useEffect(() => {
    if (cardVerdict === null) return;
    const timer = window.setTimeout(advance, 450);
    return () => window.clearTimeout(timer);
  }, [cardVerdict, advance]);

  // Keyboard: 1-5 / A-E pick, Enter/Space continue, Space reveals a card.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!entry || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key.toLowerCase();
      if (entry.item.type === "mcq") {
        if (picked === null) {
          const n = "12345".indexOf(key) >= 0 ? "12345".indexOf(key) : "abcde".indexOf(key);
          if (n >= 0 && n < entry.order.length) {
            event.preventDefault();
            choose(entry.order[n]);
          }
        } else if (key === "enter" || key === " ") {
          event.preventDefault();
          advance();
        }
      } else if (!revealed && (key === " " || key === "enter")) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && cardVerdict === null) {
        if (key === "1" || key === "a") judgeCard(false);
        if (key === "2" || key === "g" || key === "enter" || key === " ") {
          event.preventDefault();
          judgeCard(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, picked, revealed, cardVerdict, choose, advance, judgeCard]);

  if (!entry) return <div className="lesson-wrap" />;
  const percent = Math.round((doneUnique / Math.max(1, uniqueTotal)) * 100);
  const topic = topicById.get(entry.item.topicId);

  return (
    <div className="page-wrap lesson-wrap">
      <div className="lesson-top">
        <button className="icon-button" aria-label="Leave session" onClick={onExit}>
          <X size={18} />
        </button>
        <div className="lesson-progress">
          <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
          <span>{doneUnique}<i>/</i>{uniqueTotal}</span>
        </div>
        <span className={`combo-chip ${combo >= 3 ? "hot" : ""}`} title="Correct in a row"><Flame size={14} /> {combo}</span>
        <span className="xp-chip"><Zap size={14} /> {xp}</span>
      </div>

      {header && <p className="eyebrow session-header">{header}</p>}

      {entry.item.type === "mcq" ? (
        <McqView entry={entry as Entry & { item: Mcq }} picked={picked} onChoose={choose} showTopic={showTopic} topicTitle={topic ? `${topicLabel(topic)} · ${topic.title}` : ""} />
      ) : (
        <CardView card={entry.item} revealed={revealed} verdict={cardVerdict} onReveal={() => setRevealed(true)} onJudge={judgeCard} showTopic={showTopic} topicTitle={topic ? `${topicLabel(topic)} · ${topic.title}` : ""} retry={entry.retry} />
      )}

      {entry.item.type === "mcq" && picked !== null && (
        <div ref={barRef} className={`answer-bar ${picked === entry.item.answer ? "good" : "bad"}`}>
          <div className="answer-bar-inner">
            <div className="answer-bar-copy">
              <b>{picked === entry.item.answer ? (entry.retry ? "Got it this time." : pickPraise(combo)) : "Not quite."}</b>
              {picked !== entry.item.answer && <p className="answer-correct">Answer: {entry.item.options[entry.item.answer]}</p>}
              <p>{entry.item.explain}</p>
              {entry.item.note && <p className="answer-note"><span>YOUR NOTES</span>{entry.item.note}</p>}
              {picked !== entry.item.answer && <p className="answer-requeue"><RotateCcw size={13} /> This one comes back before the end.</p>}
            </div>
            <button className="button continue-button" onClick={advance} autoFocus>
              Continue <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PRAISE = ["Correct.", "Nice.", "Spot on.", "Exactly.", "Clean."];
function pickPraise(combo: number): string {
  if (combo >= 5) return `${combo} in a row.`;
  return PRAISE[combo % PRAISE.length];
}

function McqView({ entry, picked, onChoose, showTopic, topicTitle }: { entry: Entry & { item: Mcq }; picked: number | null; onChoose: (i: number) => void; showTopic?: boolean; topicTitle: string }) {
  const q = entry.item;
  return (
    <div className="question-card">
      <div className="question-meta">
        <span className="question-type">{entry.retry ? "RETRY · " : ""}{LEVEL_NAME[q.level]} · {BLOCK_LABEL[q.block].toUpperCase()}</span>
        {showTopic && <span className="question-source">{topicTitle}</span>}
      </div>
      <h2 className="question-stem">{q.stem}</h2>
      <div className="answer-options">
        {entry.order.map((optionIndex, shown) => {
          const isAnswer = optionIndex === q.answer;
          const state = picked === null ? "" : isAnswer ? "right" : optionIndex === picked ? "wrong" : "dim";
          return (
            <button key={optionIndex} className={`answer-option ${state}`} onClick={() => onChoose(optionIndex)} disabled={picked !== null}>
              <span className="option-letter">{state === "right" ? <Check size={14} /> : state === "wrong" ? <X size={14} /> : String.fromCharCode(65 + shown)}</span>
              <span>{q.options[optionIndex]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardView({ card, revealed, verdict, onReveal, onJudge, showTopic, topicTitle, retry }: { card: Card; revealed: boolean; verdict: boolean | null; onReveal: () => void; onJudge: (good: boolean) => void; showTopic?: boolean; topicTitle: string; retry: number }) {
  const lines = card.back.split(/\s+•\s+|\n/).map((l) => l.trim()).filter(Boolean);
  return (
    <div className="question-card card-mode">
      <div className="question-meta">
        <span className={`question-type ${card.university ? "uni" : ""}`}>{retry ? "RETRY · " : ""}{card.university ? "UNIVERSITY SCREENING QUESTION" : "SAY IT OUT LOUD · ORAL DRILL"}</span>
        {showTopic && <span className="question-source">{topicTitle}</span>}
      </div>
      <h2 className="question-stem">{card.front}</h2>
      {!revealed ? (
        <div className="recall-before">
          <p>{card.university ? "This is on the university's screening list. Say your answer, then check it against their official wording." : "Answer aloud or in your head as if the examiner just asked. Then check yourself honestly."}</p>
          <button className="button button-primary full-button" onClick={onReveal}>
            <span><Eye size={16} /> Reveal model answer</span> <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="recall-answer">
            <p className="eyebrow">{card.university ? "OFFICIAL ANSWER: WRITE IT LIKE THIS" : "MODEL ANSWER"}</p>
            {lines.length > 1 ? <ul>{lines.map((line, i) => <li key={i}>{line}</li>)}</ul> : <p className="recall-single">{card.back}</p>}
            {card.caveat && <p className="caveat">Note: {card.caveat}</p>}
          </div>
          <div className="recall-ratings two">
            <button className={verdict === false ? "chosen bad" : ""} onClick={() => onJudge(false)} disabled={verdict !== null}><X size={15} /> Missed parts — show again</button>
            <button className={verdict === true ? "chosen good" : ""} onClick={() => onJudge(true)} disabled={verdict !== null}><Check size={15} /> I had it</button>
          </div>
        </>
      )}
    </div>
  );
}
