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

export type ChoiceStep = {
  kind: "choice";
  id: string;
  prompt: string;
  stem: string;
  options: string[];
  answer: string;
  explain: string;
  source: BlockName;
};

export type BoolStep = {
  kind: "bool";
  id: string;
  prompt: string;
  statement: string;
  answer: boolean;
  explain: string;
};

export type ReadStep = {
  kind: "read";
  id: string;
  prompt: string;
  lines: { source: BlockName; text: string }[];
};

export type Step = ChoiceStep | BoolStep | ReadStep;

export type Completion = {
  correct: number;
  total: number;
  at: string;
};

export type Progress = {
  xp: number;
  streak: number;
  lastDay: string | null;
  lessonsToday: number;
  today: string;
  completed: Record<string, Completion>;
  mistakes: { topicId: string; prompt: string; explain: string }[];
};
