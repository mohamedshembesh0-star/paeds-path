/* Client for the server-side Claude proxy (/api/chat). The API key never reaches the browser. */

export type ChatMsg = { role: "user" | "assistant"; content: string };

export const aiAvailable = typeof window !== "undefined" && window.location.protocol !== "file:";

export async function streamChat(
  body: { mode: "tutor" | "patient"; messages: ChatMsg[]; context?: string },
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    let message = `The tutor is unavailable (${res.status}).`;
    try { const j = await res.json(); if (j?.error) message = j.error; } catch { /* not json */ }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  full += decoder.decode();
  if (!full.trim()) throw new Error("The tutor sent an empty reply. Try again.");
  onText(full);
  return full;
}

/** Text of the page the student is looking at, so the tutor can answer about it. */
export function screenText(limit = 5000): string {
  const el = document.querySelector<HTMLElement>(".main-area");
  if (!el) return "";
  return el.innerText.replace(/\n{3,}/g, "\n\n").trim().slice(0, limit);
}
