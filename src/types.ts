export type BlockName = "Def" | "Cause" | "Patho" | "Signs" | "Dx" | "Rx";

export type Topic = {
  id: string;
  section: "I" | "II" | "III";
  n: number;
  title: string;
  day: "sun" | "mon" | "tue" | "wed" | null;
  blocks: Record<BlockName, string[]>;
};

export type Course = { topics: Topic[] };

export type Mcq = {
  type: "mcq";
  id: string;
  topicId: string;
  block: BlockName;
  level: 1 | 2 | 3;
  stem: string;
  options: string[];
  answer: number;
  explain: string;
  note: string;
  quick?: boolean; // bite-size single-fact check
};

/** A short teaching step before a block's quick checks (not graded). */
export type Teach = {
  type: "teach";
  id: string;
  topicId: string;
  block: BlockName;
  lines: string[];
  explain: string;
  hook: string;
  step: number;
  steps: number;
  title?: string; // set on the topic intro card in Blitz mode
};

export type Chunk = { block: BlockName; lines: string[]; explain: string; hook: string; checks: Mcq[] };

export type Card = {
  type: "card";
  id: string;
  topicId: string;
  front: string;
  back: string;
  university?: boolean; // from the university's official screening list
  caveat?: string;
};

export type TopicBank = { summary: string; questions: Mcq[]; cards: Card[] };

/** Leitner-style memory for one question or card. */
export type ItemState = {
  box: number; // 0 = just failed, 1..6 = increasingly stable
  due: number; // epoch ms
  seen: number;
  right: number;
  wrong: number;
  last: number;
};

export type TopicState = {
  learnedAt: number; // first lesson completed
  lastAt: number;
  lessons: number;
  bestScore: number; // % first-try correct in best lesson
  lastScore: number;
  oral?: number; // last mock-oral self score (0-6 blocks)
  secs?: number; // seconds spent on the most recent lesson (for pace)
};

export type DayLog = { topics: number; answered: number; correct: number; xp: number };

export type Progress = {
  version: 2;
  xp: number;
  streak: number;
  lastDay: string | null;
  examDate: string; // YYYY-MM-DD
  items: Record<string, ItemState>;
  topics: Record<string, TopicState>;
  days: Record<string, DayLog>;
  updatedAt: number;
};
