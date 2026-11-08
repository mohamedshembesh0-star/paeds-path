import type { Progress } from "./types";

const KEY = "paeds-path-v1";

export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function yesterdayKey(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const previous = new Date(year, month - 1, date);
  previous.setDate(previous.getDate() - 1);
  return `${previous.getFullYear()}-${previous.getMonth() + 1}-${previous.getDate()}`;
}

export function emptyProgress(): Progress {
  return {
    xp: 0,
    streak: 0,
    lastDay: null,
    lessonsToday: 0,
    today: todayKey(),
    completed: {},
    mistakes: [],
  };
}

export function loadProgress(): Progress {
  const fresh = emptyProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Progress;
    const today = todayKey();
    if (saved.today !== today) {
      saved.lessonsToday = 0;
      saved.today = today;
    }
    return { ...fresh, ...saved, completed: saved.completed ?? {}, mistakes: saved.mistakes ?? [] };
  } catch {
    return fresh;
  }
}

export function saveProgress(progress: Progress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function recordLesson(progress: Progress, topicId: string, correct: number, total: number, missed: { topicId: string; prompt: string; explain: string }[]): Progress {
  const today = todayKey();
  let streak = progress.streak;
  if (progress.lastDay !== today) {
    streak = progress.lastDay === yesterdayKey(today) ? progress.streak + 1 : 1;
  }
  const xp = progress.xp + 15 + (correct === total ? 5 : 0);
  const mistakes = [...missed, ...progress.mistakes].slice(0, 40);
  return {
    ...progress,
    xp,
    streak,
    lastDay: today,
    today,
    lessonsToday: progress.today === today ? progress.lessonsToday + 1 : 1,
    completed: {
      ...progress.completed,
      [topicId]: { correct, total, at: new Date().toISOString() },
    },
    mistakes,
  };
}
