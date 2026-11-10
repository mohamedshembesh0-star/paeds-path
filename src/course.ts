import courseData from "./data/course.json";
import screeningData from "./data/screening.json";
import type { BlockName, Card, Chunk, Course, Mcq, Teach, Topic, TopicBank } from "./types";

export const BLOCKS: BlockName[] = ["Def", "Cause", "Patho", "Signs", "Dx", "Rx"];

export const BLOCK_LABEL: Record<BlockName, string> = {
  Def: "Definition",
  Cause: "Causes",
  Patho: "Pathophysiology",
  Signs: "Clinical picture",
  Dx: "Diagnosis",
  Rx: "Treatment",
};

export const SECTION_NAME: Record<Topic["section"], string> = {
  I: "Symptoms, differentials & acute care",
  II: "Prevention, infection, neonatology & oncology",
  III: "Organ systems",
};

const JUNK = /(all 165 topics|in the words of your anki|thesis line)/i;

/** The PDF parser split a few sentences after "S." or "e.g."; stitch them back together. */
function stitch(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev && /(\b[A-Z]\.|e\.g\.)$/.test(prev) && /^[a-z(]/.test(line)) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

function clean(topic: Topic): Topic {
  const blocks = {} as Record<BlockName, string[]>;
  for (const block of BLOCKS) {
    blocks[block] = stitch((topic.blocks[block] ?? []).map((line) => line.replace(/O,₂/g, "O₂").trim()).filter((line) => line.length > 2 && !JUNK.test(line)));
  }
  return { ...topic, blocks };
}

export const course: Course = { topics: (courseData as Course).topics.map(clean) };
export const topicById = new Map(course.topics.map((topic) => [topic.id, topic]));

type RawQuestion = Omit<Mcq, "id" | "topicId"> & { id?: string };
type RawCard = Omit<Card, "id" | "topicId"> & { id?: string };
type RawBank = { summary?: string; questions?: RawQuestion[]; cards?: RawCard[] };

const files = import.meta.glob("./data/qbank/*.json", { eager: true, import: "default" }) as Record<string, Record<string, RawBank>>;

function validQuestion(q: RawQuestion): boolean {
  return (
    !!q &&
    typeof q.stem === "string" &&
    Array.isArray(q.options) &&
    q.options.length >= 3 &&
    Number.isInteger(q.answer) &&
    q.answer >= 0 &&
    q.answer < q.options.length
  );
}

/** Fallback when a topic has no authored bank: recall cards straight from the notes. */
function fallbackBank(topic: Topic): TopicBank {
  const prompts: Record<BlockName, string> = {
    Def: `Define: ${topic.title}.`,
    Cause: `What causes / differentials belong to "${topic.title}"?`,
    Patho: `Explain the pathophysiology behind "${topic.title}".`,
    Signs: `What is the clinical picture of "${topic.title}"?`,
    Dx: `How do you diagnose "${topic.title}"?`,
    Rx: `How do you treat "${topic.title}"?`,
  };
  const cards: Card[] = BLOCKS.filter((block) => topic.blocks[block].length).map((block, i) => ({
    type: "card",
    id: `${topic.id}-c${i}`,
    topicId: topic.id,
    front: prompts[block],
    back: topic.blocks[block].join(" • "),
  }));
  return { summary: topic.blocks.Def[0] ?? topic.title, questions: [], cards };
}

const banks = new Map<string, TopicBank>();
for (const file of Object.values(files)) {
  for (const [topicId, raw] of Object.entries(file)) {
    if (!topicById.has(topicId)) continue;
    const questions: Mcq[] = (raw.questions ?? []).filter(validQuestion).map((q, i) => ({
      type: "mcq",
      id: `${topicId}-q${i}`,
      topicId,
      block: BLOCKS.includes(q.block) ? q.block : "Def",
      level: q.level === 1 || q.level === 3 ? q.level : 2,
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      explain: q.explain ?? "",
      note: q.note ?? "",
    }));
    const cards: Card[] = (raw.cards ?? [])
      .filter((c) => c && c.front && c.back)
      .map((c, i) => ({ type: "card", id: `${topicId}-c${i}`, topicId, front: c.front, back: c.back }));
    banks.set(topicId, { summary: raw.summary ?? "", questions, cards });
  }
}

export function bankFor(topicId: string): TopicBank {
  const bank = banks.get(topicId);
  if (bank && (bank.questions.length || bank.cards.length)) return bank;
  const topic = topicById.get(topicId);
  return topic ? fallbackBank(topic) : { summary: "", questions: [], cards: [] };
}

type RawScreening = { n: number; q: string; a: string; topicId: string; caveat?: string };

/** The university's 100 official screening questions, as oral-drill cards. */
export const screening: Card[] = (screeningData as RawScreening[]).map((s) => ({
  type: "card",
  id: `S-${s.n}`,
  topicId: s.topicId,
  front: s.q.replace(/:\s*$/, "?"),
  back: s.a,
  university: true,
  caveat: s.caveat,
}));

export function screeningFor(topicId: string): Card[] {
  return screening.filter((card) => card.topicId === topicId);
}

/* ---------- bite-size chunks: one per notes block, quick single-fact checks ---------- */

type RawCheck = { q: string; options: string[]; answer: number; why: string };
type RawChunk = { block: BlockName; explain?: string; hook?: string; checks?: RawCheck[] };
const chunkFiles = import.meta.glob("./data/chunks/*.json", { eager: true, import: "default" }) as Record<string, Record<string, RawChunk[]>>;

const chunkMap = new Map<string, Chunk[]>();
for (const file of Object.values(chunkFiles)) {
  for (const [topicId, raw] of Object.entries(file)) {
    const topic = topicById.get(topicId);
    if (!topic || !Array.isArray(raw)) continue;
    const chunks: Chunk[] = raw
      .filter((c) => BLOCKS.includes(c.block))
      .map((c, ci) => {
        const lines = topic.blocks[c.block] ?? [];
        const checks: Mcq[] = (c.checks ?? [])
          .filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
          .map((q, i) => ({
            type: "mcq",
            id: `${topicId}-f${ci}-${i}`,
            topicId,
            block: c.block,
            level: 1,
            stem: q.q,
            options: q.options,
            answer: q.answer,
            explain: q.why ?? "",
            note: lines[i] ?? "",
            quick: true,
          }));
        return { block: c.block, lines, explain: c.explain ?? "", hook: c.hook ?? "", checks };
      })
      .filter((c) => c.lines.length || c.checks.length);
    if (chunks.length) chunkMap.set(topicId, chunks);
  }
}

export function chunksFor(topicId: string): Chunk[] {
  return chunkMap.get(topicId) ?? [];
}

export function hasChunks(topicId: string): boolean {
  return chunkMap.has(topicId);
}

/** The vignettes used to "put it together" at the end of a chunked lesson. */
export function capstoneFor(topicId: string): Mcq[] {
  const qs = bankFor(topicId).questions;
  const l2 = qs.filter((q) => q.level === 2);
  const l3 = qs.filter((q) => q.level === 3);
  return [...l2.slice(0, 2), ...l3.slice(0, 1), ...qs].filter((q, i, all) => all.indexOf(q) === i).slice(0, 3);
}

/** Lesson steps: teach a block → quick checks on it → next block … → 3 vignettes. */
/** Test-first lesson: quick checks block by block (the notes line + hook appear on a miss), then 1 vignette. */
export function fastLessonSteps(topicId: string): Mcq[] {
  const checks = chunksFor(topicId).flatMap((c) => c.checks);
  const cap = capstoneFor(topicId);
  const hard = cap.find((q) => q.level === 3) ?? cap[0];
  return hard ? [...checks, hard] : checks;
}

/** Blitz: several topics back to back; a one-card intro per topic, then its quick checks. */
export function blitzSteps(topicIds: string[]): (Teach | Mcq)[] {
  const steps: (Teach | Mcq)[] = [];
  topicIds.forEach((id, i) => {
    const topic = topicById.get(id);
    if (!topic) return;
    const summary = bankFor(id).summary;
    steps.push({ type: "teach", id: `${id}-intro`, topicId: id, block: "Def", lines: summary ? [summary] : [], explain: "", hook: "", step: i + 1, steps: topicIds.length, title: topic.title });
    steps.push(...chunksFor(id).flatMap((c) => c.checks));
  });
  return steps;
}

export function hookFor(topicId: string, block: BlockName): string {
  return chunksFor(topicId).find((c) => c.block === block)?.hook ?? "";
}

export function lessonSteps(topicId: string): (Teach | Mcq)[] {
  const chunks = chunksFor(topicId);
  const steps: (Teach | Mcq)[] = [];
  chunks.forEach((c, i) => {
    steps.push({ type: "teach", id: `${topicId}-t${i}`, topicId, block: c.block, lines: c.lines, explain: c.explain, hook: c.hook, step: i + 1, steps: chunks.length });
    steps.push(...c.checks);
  });
  return [...steps, ...capstoneFor(topicId)];
}

export const allChecks: Mcq[] = course.topics.flatMap((t) => chunksFor(t.id).flatMap((c) => c.checks));
export const checkCount = allChecks.length;

export const allItems: (Mcq | Card)[] = [
  ...allChecks,
  ...course.topics.flatMap((topic) => {
    const bank = bankFor(topic.id);
    return [...bank.questions, ...bank.cards];
  }),
  ...screening,
];
export const itemById = new Map(allItems.map((item) => [item.id, item]));

export const questionCount = allItems.filter((item) => item.type === "mcq").length;
export const authoredTopics = course.topics.filter((topic) => (banks.get(topic.id)?.questions.length ?? 0) > 0).length;

const DAY_ORDER: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3 };

/**
 * Study order: the topics never reviewed in Anki (tagged with a day) come first,
 * in the order they were scheduled, then everything else in syllabus order.
 */
export const studyOrder: Topic[] = [...course.topics].sort((a, b) => {
  const da = a.day ? DAY_ORDER[a.day] : 9;
  const db = b.day ? DAY_ORDER[b.day] : 9;
  if (da !== db) return da - db;
  return course.topics.indexOf(a) - course.topics.indexOf(b);
});

export function topicLabel(topic: Topic): string {
  return `${topic.section}-${topic.n}`;
}
