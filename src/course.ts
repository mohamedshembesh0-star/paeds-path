import courseData from "./data/course.json";
import screeningData from "./data/screening.json";
import type { BlockName, Card, Course, Mcq, Topic, TopicBank } from "./types";

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

export const allItems: (Mcq | Card)[] = [
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
