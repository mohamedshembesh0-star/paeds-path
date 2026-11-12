/* Maps "tool used on body region" to the exam steps in patients.ts (by index), so the drawn patient can be examined by hand. */

export type Tool = "prep" | "monitor" | "measure" | "look" | "hand" | "percuss" | "steth" | "light" | "reflex" | "finish";
export type Region = "whole" | "head" | "eyes" | "mouth" | "neck" | "chestR" | "chestL" | "heart" | "baseR" | "baseL" | "abdomen" | "groin" | "hands" | "legs" | "back" | "spine" | "backUL" | "backUR" | "backBL" | "backBR";

export type Rule = { tool: Tool; at?: Region[]; items?: number[]; note?: string };
export type Sounds = { hr: number; rr: number; bronchial: Region[]; crackles: Region[]; dull: Region[] };
export type ExamMap = { tools: Tool[]; rules: Rule[]; sounds: Sounds };

const FRONT_LUNGS: Region[] = ["chestR", "chestL", "baseR", "baseL"];
const BACK_LUNGS: Region[] = ["backUL", "backUR", "backBL", "backBR"];

export const EXAM_MAPS: Record<string, ExamMap> = {
  neonate: {
    tools: ["prep", "measure", "monitor", "look", "hand", "steth", "light", "reflex"],
    sounds: { hr: 138, rr: 46, bronchial: [], crackles: [], dull: [] },
    rules: [
      { tool: "prep", items: [0] },
      { tool: "measure", items: [1] },
      { tool: "monitor", items: [2] },
      { tool: "look", at: ["whole"], items: [3, 4] },
      { tool: "look", at: ["chestR", "chestL", "heart", "baseR", "baseL"], items: [9] },
      { tool: "look", at: ["abdomen"], items: [12] },
      { tool: "look", at: ["groin"], items: [14] },
      { tool: "look", at: ["mouth"], items: [8] },
      { tool: "look", at: ["hands", "legs", "neck"], items: [17] },
      { tool: "look", at: ["back"], items: [5] },
      { tool: "look", at: ["spine"], items: [16] },
      { tool: "look", at: ["head"], note: "Normal head shape. Now feel the fontanelles and sutures with your hand." },
      { tool: "look", at: ["eyes"], note: "The sclerae look yellow. Use the penlight to check the red reflex." },
      { tool: "hand", at: ["head"], items: [6] },
      { tool: "hand", at: ["chestR", "chestL", "heart", "baseR", "baseL"], items: [3] },
      { tool: "hand", at: ["abdomen"], items: [13] },
      { tool: "hand", at: ["groin"], items: [11] },
      { tool: "hand", at: ["legs"], items: [15] },
      { tool: "hand", at: ["hands", "neck"], items: [17] },
      { tool: "hand", at: ["back", "spine"], items: [16] },
      { tool: "hand", at: ["whole"], items: [18] },
      { tool: "steth", at: ["chestR", "chestL", "heart", "baseR", "baseL", "back"], items: [10] },
      { tool: "steth", at: ["abdomen"], note: "Bowel sounds present." },
      { tool: "light", at: ["eyes"], items: [7] },
      { tool: "light", at: ["mouth"], items: [8] },
      { tool: "reflex", at: ["hands", "mouth", "head"], items: [19] },
      { tool: "reflex", items: [18] },
    ],
  },
  teen: {
    tools: ["prep", "monitor", "look", "hand", "percuss", "steth", "light", "finish"],
    sounds: { hr: 112, rr: 28, bronchial: ["backBR"], crackles: ["backBR", "baseR"], dull: ["backBR"] },
    rules: [
      { tool: "prep", items: [0] },
      { tool: "monitor", items: [1] },
      { tool: "finish", items: [17] },
      { tool: "look", at: ["whole"], items: [2] },
      { tool: "look", at: ["hands"], items: [3] },
      { tool: "look", at: ["head", "eyes", "neck"], items: [4] },
      { tool: "look", at: ["mouth"], items: [16] },
      { tool: "look", at: [...FRONT_LUNGS, "heart", ...BACK_LUNGS], items: [5] },
      { tool: "look", at: ["abdomen"], note: "Abdomen not distended. No scars." },
      { tool: "look", at: ["legs"], note: "No ankle oedema, no rash." },
      { tool: "hand", at: ["neck", "heart"], items: [6] },
      { tool: "hand", at: FRONT_LUNGS, items: [7] },
      { tool: "hand", at: ["backBR"], items: [8] },
      { tool: "hand", at: ["backUL", "backUR", "backBL"], note: "Normal fremitus here. Compare with the same zone on the other side, and work down to the bases." },
      { tool: "hand", at: ["abdomen"], items: [14] },
      { tool: "hand", at: ["hands"], items: [3] },
      { tool: "percuss", at: ["backBR"], items: [9] },
      { tool: "percuss", at: ["baseR"], note: "A little less resonant than the left side. Now percuss the back, comparing sides." },
      { tool: "percuss", at: ["chestR", "chestL", "baseL", "backUL", "backUR", "backBL"], note: "Resonant. Keep going: compare side with side, front and back, down to the bases." },
      { tool: "percuss", at: ["heart"], note: "Cardiac dullness, normal position." },
      { tool: "steth", at: ["backBR"], items: [10, 11, 12] },
      { tool: "steth", at: ["baseR"], note: "A few crackles here. Listen at the back over the same lung." },
      { tool: "steth", at: ["chestR", "chestL", "baseL", "backUL", "backUR", "backBL"], note: "Normal vesicular breathing, no added sounds. Compare with the other side and listen at the bases." },
      { tool: "steth", at: ["heart"], items: [13] },
      { tool: "steth", at: ["abdomen"], note: "Bowel sounds present." },
      { tool: "light", at: ["mouth", "head", "eyes"], items: [15] },
    ],
  },
};

export const TOOL_INFO: Record<Tool, { label: string; hint: string; instant?: boolean }> = {
  prep: { label: "Wash hands", hint: "Hand hygiene, introduce yourself, consent, expose", instant: true },
  monitor: { label: "Vitals", hint: "Monitor: temperature, pulse, breathing, saturation", instant: true },
  measure: { label: "Measure", hint: "Weight, length, head circumference", instant: true },
  look: { label: "Look", hint: "Inspect: tap a body part, or the whole patient" },
  hand: { label: "Feel", hint: "Palpate: tap where you put your hand" },
  percuss: { label: "Percuss", hint: "Tap a zone, compare both sides" },
  steth: { label: "Listen", hint: "Stethoscope: tap where you place it" },
  light: { label: "Penlight", hint: "Shine it at the eyes, mouth or ears" },
  reflex: { label: "Reflexes", hint: "Tone and primitive reflexes: tap the body or the hands" },
  finish: { label: "Finish", hint: "Thank, cover, wash hands", instant: true },
};

export const REGION_LABEL: Record<Region, string> = {
  whole: "whole patient", head: "head", eyes: "eyes", mouth: "mouth", neck: "neck", chestR: "right upper chest", chestL: "left upper chest", heart: "heart", baseR: "right lower chest", baseL: "left lower chest",
  abdomen: "abdomen", groin: "groin", hands: "hands", legs: "legs and hips", back: "back", spine: "lower spine", backUL: "left upper back", backUR: "right upper back", backBL: "left base (back)", backBR: "right base (back)",
};
