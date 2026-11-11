import { allChecks, allItems, bankFor, capstoneFor, chunksFor, course, itemById, screening, studyOrder, topicById } from "./course";
import type { BlockName, Card, ItemState, Mcq, Progress, Topic, TopicState } from "./types";
import seedData from "./data/seed-progress.json";

const SEED_FLAG = "paeds-seed-2026-11-11";

const KEY = "paeds-path-v2";
const OLD_KEY = "paeds-path-v1";
export const DEFAULT_EXAM = "2026-11-12";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Compressed Leitner ladder for a short pre-exam window. Index = box. */
export const INTERVALS = [0, 10 * MIN, 3 * HOUR, 8 * HOUR, DAY, 2 * DAY, 4 * DAY];
const MAX_BOX = INTERVALS.length - 1;

export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function emptyProgress(): Progress {
  return { version: 2, xp: 0, streak: 0, lastDay: null, examDate: DEFAULT_EXAM, items: {}, topics: {}, days: {}, updatedAt: Date.now() };
}

function sanitize(raw: unknown): Progress | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Progress>;
  if (value.version !== 2) return null;
  const fresh = emptyProgress();
  return {
    ...fresh,
    xp: Math.max(0, Number(value.xp) || 0),
    streak: Math.max(0, Number(value.streak) || 0),
    lastDay: typeof value.lastDay === "string" ? value.lastDay : null,
    examDate: typeof value.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.examDate) ? value.examDate : DEFAULT_EXAM,
    items: value.items && typeof value.items === "object" ? value.items : {},
    topics: value.topics && typeof value.topics === "object" ? value.topics : {},
    days: value.days && typeof value.days === "object" ? value.days : {},
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

export function loadProgress(): Progress {
  const base = loadStored();
  // One-time: fold in the owner's latest exported progress so every device starts from it.
  try {
    if (!localStorage.getItem(SEED_FLAG)) {
      localStorage.setItem(SEED_FLAG, "1");
      const seed = sanitize(seedData);
      if (seed) {
        const merged = mergeProgress(base, seed);
        localStorage.setItem(KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch {
    /* storage blocked: carry on with what we have */
  }
  return base;
}

function loadStored(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw)) ?? emptyProgress();
    // Carry streak and points over from the first version; its quiz scores are not meaningful.
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const parsed = JSON.parse(old) as { xp?: number; streak?: number; lastDay?: string };
      return { ...emptyProgress(), xp: Number(parsed.xp) || 0, streak: Number(parsed.streak) || 0 };
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return emptyProgress();
}

export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function parseImport(text: string): Progress | null {
  try {
    return sanitize(JSON.parse(text));
  } catch {
    return null;
  }
}

/* ---------- transfer code (compressed, copy/paste between devices) ---------- */

async function streamBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function toTransferCode(progress: Progress): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(progress));
  let bytes: Uint8Array = json;
  let prefix = "PP2J.";
  if (typeof CompressionStream !== "undefined") {
    bytes = await streamBytes(new Blob([json as BlobPart]).stream().pipeThrough(new CompressionStream("gzip")));
    prefix = "PP2Z.";
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return prefix + btoa(binary);
}

export async function fromTransferCode(code: string): Promise<Progress | null> {
  const trimmed = code.trim();
  if (trimmed.startsWith("{")) return parseImport(trimmed);
  const match = /^PP2([JZ])\.(.+)$/s.exec(trimmed.replace(/\s+/g, ""));
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    let json: Uint8Array = bytes;
    if (match[1] === "Z") {
      if (typeof DecompressionStream === "undefined") return null;
      json = await streamBytes(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip")));
    }
    return parseImport(new TextDecoder().decode(json));
  } catch {
    return null;
  }
}

/** Merge two progress files (e.g. phone + laptop): keep the most-practised state per item. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const items: Progress["items"] = { ...a.items };
  for (const [id, state] of Object.entries(b.items)) {
    const mine = items[id];
    if (!mine || state.last > mine.last) items[id] = { ...state, seen: Math.max(state.seen, mine?.seen ?? 0) };
  }
  const topics: Progress["topics"] = { ...a.topics };
  for (const [id, state] of Object.entries(b.topics)) {
    const mine = topics[id];
    if (!mine) topics[id] = state;
    else
      topics[id] = {
        learnedAt: Math.min(mine.learnedAt, state.learnedAt),
        lastAt: Math.max(mine.lastAt, state.lastAt),
        lessons: Math.max(mine.lessons, state.lessons),
        bestScore: Math.max(mine.bestScore, state.bestScore),
        lastScore: mine.lastAt >= state.lastAt ? mine.lastScore : state.lastScore,
        oral: mine.lastAt >= state.lastAt ? mine.oral ?? state.oral : state.oral ?? mine.oral,
      };
  }
  const days: Progress["days"] = { ...a.days };
  for (const [key, log] of Object.entries(b.days)) {
    const mine = days[key];
    days[key] = mine
      ? { topics: Math.max(mine.topics, log.topics), answered: Math.max(mine.answered, log.answered), correct: Math.max(mine.correct, log.correct), xp: Math.max(mine.xp, log.xp) }
      : log;
  }
  return {
    version: 2,
    xp: Math.max(a.xp, b.xp),
    streak: Math.max(a.streak, b.streak),
    lastDay: [a.lastDay, b.lastDay].filter(Boolean).sort().pop() ?? null,
    examDate: a.updatedAt >= b.updatedAt ? a.examDate : b.examDate,
    items,
    topics,
    days,
    updatedAt: Date.now(),
  };
}

/* ---------- recording ---------- */

function touchDay(progress: Progress, patch: Partial<Progress["days"][string]>): Progress {
  const today = dayKey();
  const log = progress.days[today] ?? { topics: 0, answered: 0, correct: 0, xp: 0 };
  let streak = progress.streak;
  if (progress.lastDay !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    streak = progress.lastDay === dayKey(yesterday) ? progress.streak + 1 : 1;
  }
  return {
    ...progress,
    streak,
    lastDay: today,
    xp: progress.xp + (patch.xp ?? 0),
    days: {
      ...progress.days,
      [today]: {
        topics: log.topics + (patch.topics ?? 0),
        answered: log.answered + (patch.answered ?? 0),
        correct: log.correct + (patch.correct ?? 0),
        xp: log.xp + (patch.xp ?? 0),
      },
    },
    updatedAt: Date.now(),
  };
}

/**
 * Grade one item. `firstTry` = the first time it was answered in this session.
 * Only the first attempt moves the schedule up; any miss drops the item to box 1.
 */
export function gradeItem(progress: Progress, itemId: string, correct: boolean, firstTry: boolean, mode: "lesson" | "review"): Progress {
  const now = Date.now();
  const prev = progress.items[itemId];
  let box: number;
  if (!correct || !firstTry) box = 1; // a miss (or a retry after a miss this session) restarts the ladder
  else if (!prev || prev.seen === 0) box = mode === "lesson" || itemId.startsWith("S-") ? 3 : 2;
  else box = Math.min(MAX_BOX, Math.max(prev.box, 0) + 1);
  const state: ItemState = {
    box,
    due: now + INTERVALS[box],
    seen: (prev?.seen ?? 0) + (firstTry ? 1 : 0),
    right: (prev?.right ?? 0) + (correct && firstTry ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (!correct && firstTry ? 1 : 0),
    last: now,
  };
  const xp = correct ? (firstTry ? 10 : 4) : 0;
  const next = { ...progress, items: { ...progress.items, [itemId]: state } };
  return touchDay(next, { answered: firstTry ? 1 : 0, correct: correct && firstTry ? 1 : 0, xp });
}

export function completeLesson(progress: Progress, topicId: string, score: number, secs?: number): Progress {
  const now = Date.now();
  const prev = progress.topics[topicId];
  const state: TopicState = {
    learnedAt: prev?.learnedAt ?? now,
    lastAt: now,
    lessons: (prev?.lessons ?? 0) + 1,
    bestScore: Math.max(prev?.bestScore ?? 0, score),
    lastScore: score,
    oral: prev?.oral,
    secs: secs && secs > 5 && secs < 3600 ? Math.round(secs) : prev?.secs,
  };
  const next = { ...progress, topics: { ...progress.topics, [topicId]: state } };
  return touchDay(next, { topics: prev ? 0 : 1, xp: 25 + (score === 100 ? 15 : 0) });
}

/** Record a mock-oral self-assessment; blocks you could not say are pulled forward for review. */
export function recordOral(progress: Progress, topicId: string, missedBlocks: BlockName[], score: number): Progress {
  const now = Date.now();
  const bank = bankFor(topicId);
  const items = { ...progress.items };
  for (const q of bank.questions) {
    if (missedBlocks.includes(q.block)) {
      const prev = items[q.id];
      items[q.id] = { box: 1, due: now, seen: prev?.seen ?? 0, right: prev?.right ?? 0, wrong: prev?.wrong ?? 0, last: prev?.last ?? now };
    }
  }
  if (missedBlocks.length) {
    for (const c of bank.cards) {
      const prev = items[c.id];
      items[c.id] = { box: 1, due: now, seen: prev?.seen ?? 0, right: prev?.right ?? 0, wrong: prev?.wrong ?? 0, last: prev?.last ?? now };
    }
  }
  const prevTopic = progress.topics[topicId];
  const topics = prevTopic ? { ...progress.topics, [topicId]: { ...prevTopic, oral: score } } : progress.topics;
  return touchDay({ ...progress, items, topics }, { xp: 15 });
}

/* ---------- derived views ---------- */

export function daysUntilExam(progress: Progress): number {
  const today = parseDay(dayKey());
  const exam = parseDay(progress.examDate);
  return Math.round((exam.getTime() - today.getTime()) / DAY);
}

export function topicMastery(progress: Progress, topicId: string): number {
  const bank = bankFor(topicId);
  const checks = chunksFor(topicId).flatMap((c) => c.checks);
  // Chunked topics: mastery = the lesson's quick checks + capstone vignettes, plus any extra item already practised.
  const core = checks.length ? [...checks, ...capstoneFor(topicId)] : [...bank.questions, ...bank.cards];
  const extra = checks.length ? [...bank.questions, ...bank.cards].filter((i) => !core.includes(i as Mcq) && progress.items[i.id]) : [];
  const items = [...core, ...extra];
  if (!items.length) return progress.topics[topicId] ? 100 : 0;
  const total = items.reduce((sum, item) => {
    const state = progress.items[item.id];
    if (!state) return sum;
    return sum + Math.min(state.box, 4) / 4;
  }, 0);
  return Math.round((total / items.length) * 100);
}

export type Plan = {
  daysLeft: number; // study days remaining including today
  examIn: number; // calendar days until exam
  learnedTotal: number;
  learnedToday: number;
  targetToday: number;
  remaining: number;
  next: Topic | undefined;
  queueToday: Topic[];
};

export function buildPlan(progress: Progress): Plan {
  const examIn = daysUntilExam(progress);
  const daysLeft = Math.max(1, examIn);
  const today = dayKey();
  const learned = (id: string) => !!progress.topics[id];
  const learnedToday = Object.values(progress.topics).filter((t) => dayKey(new Date(t.learnedAt)) === today).length;
  const unlearned = studyOrder.filter((topic) => !learned(topic.id));
  const remaining = unlearned.length;
  const targetToday = remaining === 0 ? learnedToday : Math.ceil((remaining + learnedToday) / daysLeft);
  const leftToday = Math.max(0, targetToday - learnedToday);
  return {
    daysLeft,
    examIn,
    learnedTotal: course.topics.length - remaining,
    learnedToday,
    targetToday,
    remaining,
    next: unlearned[0],
    queueToday: unlearned.slice(0, leftToday),
  };
}

export function dueItems(progress: Progress, now = Date.now()): (Mcq | Card)[] {
  return Object.entries(progress.items)
    .filter(([id, state]) => state.due <= now && itemById.has(id) && !id.startsWith("S-"))
    .sort(([, a], [, b]) => a.box - b.box || a.due - b.due)
    .map(([id]) => itemById.get(id)!)
    .filter((item) => !!progress.topics[item.topicId] || progress.items[item.id].box <= 1)
    // Fast multiple-choice relearning first, slower vignettes and oral cards after.
    .sort((a, b) => Number(!(a.type === "mcq" && a.quick)) - Number(!(b.type === "mcq" && b.quick)));
}

/** Screening drill: never-seen first (in list order), then the shakiest / most overdue. */
export function screeningDrill(progress: Progress, size = 25): Card[] {
  const now = Date.now();
  const unseen = screening.filter((c) => !progress.items[c.id]);
  const seen = screening
    .filter((c) => progress.items[c.id])
    .sort((a, b) => {
      const sa = progress.items[a.id], sb = progress.items[b.id];
      const da = sa.due <= now ? 0 : 1, db = sb.due <= now ? 0 : 1;
      return da - db || sa.box - sb.box || sa.due - sb.due;
    });
  return [...unseen, ...seen].slice(0, size);
}

export function screeningStats(progress: Progress) {
  let seen = 0, solid = 0, shaky = 0;
  for (const c of screening) {
    const s = progress.items[c.id];
    if (!s) continue;
    seen += 1;
    if (s.box >= 3) solid += 1;
    else shaky += 1;
  }
  return { total: screening.length, seen, solid, shaky };
}

export function weakItems(progress: Progress): (Mcq | Card)[] {
  return Object.entries(progress.items)
    .filter(([id, state]) => state.wrong > 0 && state.box <= 2 && itemById.has(id) && !id.startsWith("S-"))
    .sort(([, a], [, b]) => b.wrong - a.wrong || a.box - b.box)
    .map(([id]) => itemById.get(id)!);
}

export function nextDueAt(progress: Progress): number | null {
  const times = Object.values(progress.items).map((s) => s.due).filter((t) => t > Date.now());
  return times.length ? Math.min(...times) : null;
}

export function mixedDrill(progress: Progress, size = 20): Mcq[] {
  const learnedTopics = new Set(Object.keys(progress.topics));
  const pool = allItems.filter((item): item is Mcq => item.type === "mcq" && (learnedTopics.size === 0 || learnedTopics.has(item.topicId)));
  const weight = (q: Mcq) => {
    const s = progress.items[q.id];
    if (!s) return 2;
    return 1 + (MAX_BOX - s.box) + s.wrong * 2;
  };
  const scored = pool.map((q) => ({ q, key: Math.random() ** (1 / weight(q)) }));
  scored.sort((a, b) => b.key - a.key);
  return scored.slice(0, size).map((entry) => entry.q);
}

/** Rapid fire: quick single-fact checks from learned topics (or a chosen section), weakest first-ish. */
export function rapidFire(progress: Progress, size = 30, section?: Topic["section"]): Mcq[] {
  const learned = new Set(Object.keys(progress.topics));
  let pool = allChecks.filter((q) => (!section || topicById.get(q.topicId)?.section === section));
  const learnedPool = pool.filter((q) => learned.has(q.topicId));
  if (learnedPool.length >= 10) pool = learnedPool;
  const weight = (q: Mcq) => {
    const st = progress.items[q.id];
    if (!st) return 2;
    return 1 + Math.max(0, 4 - st.box) + st.wrong * 2;
  };
  return pool
    .map((q) => ({ q, key: Math.random() ** (1 / weight(q)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, size)
    .map((x) => x.q);
}

/** Median seconds per topic over recent lessons (null until there is data). */
export function pace(progress: Progress): number | null {
  const recent = Object.values(progress.topics)
    .filter((t) => t.secs)
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, 15)
    .map((t) => t.secs!)
    .sort((a, b) => a - b);
  if (!recent.length) return null;
  return recent[Math.floor(recent.length / 2)];
}

export function accuracy(progress: Progress): number {
  const states = Object.values(progress.items);
  const right = states.reduce((s, x) => s + x.right, 0);
  const wrong = states.reduce((s, x) => s + x.wrong, 0);
  return right + wrong ? Math.round((right / (right + wrong)) * 100) : 0;
}

export function sectionStats(progress: Progress, section: Topic["section"]) {
  const topics = course.topics.filter((t) => t.section === section);
  const learned = topics.filter((t) => progress.topics[t.id]).length;
  const mastery = Math.round(topics.reduce((s, t) => s + topicMastery(progress, t.id), 0) / topics.length);
  return { total: topics.length, learned, mastery };
}

export function blockAccuracy(progress: Progress): Record<BlockName, { right: number; wrong: number }> {
  const out = { Def: { right: 0, wrong: 0 }, Cause: { right: 0, wrong: 0 }, Patho: { right: 0, wrong: 0 }, Signs: { right: 0, wrong: 0 }, Dx: { right: 0, wrong: 0 }, Rx: { right: 0, wrong: 0 } };
  for (const [id, state] of Object.entries(progress.items)) {
    const item = itemById.get(id);
    if (item?.type !== "mcq") continue;
    out[item.block].right += state.right;
    out[item.block].wrong += state.wrong;
  }
  return out;
}

export { topicById };
