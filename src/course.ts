import type { BlockName, ChoiceStep, Course, Step, Topic } from "./types";

const BLOCKS: BlockName[] = ["Def", "Cause", "Patho", "Signs", "Dx", "Rx"];

const BLOCK_LABEL: Record<BlockName, string> = {
  Def: "Definition",
  Cause: "Cause",
  Patho: "What happens",
  Signs: "What you see",
  Dx: "How you diagnose it",
  Rx: "What you do",
};

export const DAY_LABEL: Record<NonNullable<Topic["day"]>, string> = {
  sun: "Tonight",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
};

type Fact = { source: BlockName; text: string };
type Cut = { source: BlockName; text: string; setup: string; answer: string; score: number };

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

function randomOf(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function usable(text: string): boolean {
  const line = text.trim();
  if (line.length < 24 || line.length > 170) return false;
  if (/[,;:]\s*$/.test(line) || line.includes("· Thesis")) return false;
  return true;
}

function cutFact(source: BlockName, text: string): Cut | null {
  if (!usable(text)) return null;
  const line = text.trim();
  const seps = [
    { token: "→", bonus: 40 },
    { token: "=", bonus: 30 },
    { token: ": ", bonus: 20 },
    { token: "; ", bonus: 8 },
  ];
  let best: Cut | null = null;
  for (const sep of seps) {
    let from = 0;
    while (from < line.length) {
      const at = line.indexOf(sep.token, from);
      if (at < 0) break;
      const setup = line.slice(0, at).trim().replace(/[;:,]\s*$/, "");
      const answer = line.slice(at + sep.token.length).trim();
      const tidy = setup.length >= 12 && setup.length <= 85 && answer.length >= 12 && answer.length <= 72 && !setup.startsWith("→");
      if (tidy) {
        let score = sep.bonus + Math.min(setup.length, 36) - Math.floor(at / 12);
        if (!answer.includes(":") && !answer.includes("→") && !answer.includes("=")) score += 30;
        if (answer.length <= 48) score += 8;
        if (/[,;]\s*$/.test(answer)) score -= 20;
        const cut = { source, text: line, setup, answer, score };
        if (!best || cut.score > best.score) best = cut;
      }
      from = at + sep.token.length;
    }
  }
  return best && best.score >= 30 ? best : null;
}

function cutsOf(topic: Topic): Cut[] {
  const cuts: Cut[] = [];
  for (const source of BLOCKS) {
    for (const text of topic.blocks[source]) {
      const cut = cutFact(source, text);
      if (cut) cuts.push(cut);
    }
  }
  return cuts;
}

function factsOf(topic: Topic): Fact[] {
  const facts: Fact[] = [];
  for (const source of BLOCKS) {
    for (const text of topic.blocks[source]) {
      if (usable(text)) facts.push({ source, text: text.trim() });
    }
  }
  return facts;
}

function pickLessonCuts(cuts: Cut[]): Cut[] {
  const picked: Cut[] = [];
  const used = new Set<string>();
  for (const source of BLOCKS) {
    const next = cuts
      .filter((cut) => cut.source === source && !used.has(cut.text))
      .sort((a, b) => b.score - a.score)[0];
    if (!next) continue;
    picked.push(next);
    used.add(next.text);
    if (picked.length === 4) break;
  }
  return picked;
}

function distractorsFor(answer: string, own: Cut[], random: () => number): string[] {
  return shuffle(
    own.map((cut) => cut.answer).filter((item, index, all) => item !== answer && all.indexOf(item) === index),
    random,
  ).slice(0, 3);
}

export function buildLesson(topic: Topic, _course: Course, attempt = 0): Step[] {
  const random = randomOf(hash(`${topic.id}:${attempt}`));
  const ownCuts = cutsOf(topic);
  const taught = pickLessonCuts(ownCuts);
  const steps: Step[] = [];

  taught.forEach((cut, index) => {
    steps.push({
      kind: "read",
      id: `${topic.id}-teach${index}`,
      prompt: topic.title,
      lines: [{ source: cut.source, text: cut.text }],
    });
    const wrong = distractorsFor(cut.answer, ownCuts, random);
    if (wrong.length >= 2) {
      const step: ChoiceStep = {
        kind: "choice",
        id: `${topic.id}-do${index}`,
        prompt: topic.title,
        stem: `${cut.setup} …`,
        options: shuffle([cut.answer, ...wrong], random),
        answer: cut.answer,
        explain: cut.text,
        source: cut.source,
      };
      steps.push(step);
    }
  });

  const review = taught.filter((cut) => steps.some((step) => step.kind === "choice" && step.explain === cut.text));
  review.slice(0, 2).forEach((cut, index) => {
    const wrong = distractorsFor(cut.answer, ownCuts, random);
    if (wrong.length < 2) return;
    steps.push({
      kind: "choice",
      id: `${topic.id}-recall${index}`,
      prompt: topic.title,
      stem: `${cut.setup} …`,
      options: shuffle([cut.answer, ...wrong], random),
      answer: cut.answer,
      explain: cut.text,
      source: cut.source,
    });
  });

  const trueFact = shuffle(factsOf(topic).filter((fact) => fact.source === "Rx" || fact.source === "Signs"), random)[0]
    ?? factsOf(topic)[0];
  if (trueFact) {
    steps.push({
      kind: "bool",
      id: `${topic.id}-true`,
      prompt: topic.title,
      statement: trueFact.text,
      answer: true,
      explain: trueFact.text,
    });
  }

  return steps;
}

export function nextTopic(topics: Topic[], completed: Record<string, unknown>): Topic | undefined {
  return topics.find((topic) => !completed[topic.id]);
}

export { BLOCK_LABEL };
