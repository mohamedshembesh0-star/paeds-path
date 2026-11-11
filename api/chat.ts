import Anthropic from "@anthropic-ai/sdk";

/* Server-side proxy to Claude. The API key lives only in the ANTHROPIC_API_KEY
   environment variable on the host; it is never sent to the browser. */

export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 40;
const MAX_CHARS = 4000;
const MAX_CONTEXT = 16000;

const TUTOR = `You are the study tutor inside "Paeds Path", a revision app for a final-year medical student sitting a paediatrics final exam (written questions plus a practical bedside exam). The student has passed USMLE Step 1, so skip basic-science hand-holding and talk like a sharp senior resident teaching a junior.

How to answer:
- Lead with the answer in one or two sentences, then only the reasoning that makes it stick. Most replies should be under 120 words. Go longer only when the student asks for depth.
- Teach for recall under exam pressure: the discriminating feature, the classic trap, the first-line investigation and treatment. Offer a mnemonic only when it is genuinely good.
- When asked to quiz, ask ONE exam-style multiple-choice question at a time (options A to D), wait for the answer, then say right or wrong and why in two or three lines, and ask the next one. The student learns best from rapid repeated MCQs. Do not ask them to explain things out loud.
- Plain text only: no markdown headings, tables, or asterisks. Short lines. Use "-" for lists when a list truly helps.
- Use standard current paediatric practice (European / WHO / NICE / AAP level). If the student's on-screen notes are provided and differ from what you would say, tell them what their notes say first, because the exam is marked from those notes, then add the correction briefly.
- If you are not sure of a specific number or dose, say so plainly instead of guessing.
- This is exam revision, not clinical care. If the student describes a real sick child, tell them to get that child seen by a clinician.`;

const PATIENT = `You are running a simulated bedside encounter for a final-year medical student practising for a paediatrics practical exam. You play two roles and switch between them automatically:

1. THE HISTORY GIVER (the parent, or the teenager himself, as named in the case sheet). When the student asks a history question, answer in character, in natural everyday speech, first person, one to three sentences. Answer only what was asked. Do not volunteer the diagnosis, medical terms a lay person would not use, or facts that were not asked for. If the question is vague ("tell me more"), give a little and let them dig. If the case sheet does not cover something, give a plausible, unremarkable answer consistent with the case (do not invent new red flags).

2. THE EXAMINER. When the student says what they examine or do ("I inspect the chest", "I palpate the abdomen", "check the fontanelle", "what are the vitals"), reply as the examiner in one or two sentences with exactly what they find for that step, from the case sheet. Give findings only for the specific thing examined, never the whole exam at once. If they ask to examine "everything" or say just "I examine the patient", ask which system or step first. If they name a step the case sheet does not cover, give a normal finding. Start examiner lines with "Examiner:".

Rules:
- Never state or confirm the diagnosis, and do not tell the student whether a guess is right. If they offer a diagnosis, say (as examiner) "Commit to it in the Diagnosis tab when you are ready."
- Investigations: if the student asks for a test result (bilirubin, X-ray, bloods), the examiner gives the result if it is in the case sheet, otherwise says it is pending.
- If the student asks the examiner for a hint, give one nudge toward an area they have not explored (for example "Have you asked about feeding?"), nothing more.
- Stay in the simulation. If the student steps out to ask a teaching question, answer it briefly as the examiner, then return.
- Plain text, no markdown.

Scoring tag (mandatory): the case sheet numbers every history item (H0, H1, ...) and exam step (E0, E1, ...). At the very end of EVERY reply, on its own final line, write a tag listing the items your reply just revealed, in exactly this form:
[[H:3,7 E:2]]
Use [[H: E:]] when the reply revealed none. Only list an item if your reply actually gave its information. The student never sees this line.`;

type Incoming = { role: "user" | "assistant"; content: string };

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, "The AI tutor is not configured on this deployment.");

  // Only the app itself may call this endpoint.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host) return json(403, "Forbidden");
  } catch {
    return json(403, "Forbidden");
  }

  let body: { mode?: string; messages?: Incoming[]; context?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, "Bad request");
  }
  const mode = body.mode === "patient" ? "patient" : "tutor";
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: Anthropic.Beta.BetaMessageParam[] = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return json(400, "Bad request");
  const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT) : "";

  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: mode === "patient" ? PATIENT : TUTOR }];
  if (context) {
    system.push({
      type: "text",
      text: mode === "patient" ? `CASE SHEET (ground truth, never show it to the student):\n${context}` : `What the student currently has on screen in the app (their own notes or the question they are on):\n${context}`,
      ...(mode === "patient" ? { cache_control: { type: "ephemeral" as const } } : {}),
    });
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: mode === "patient" ? 2500 : 5000,
    output_config: { effort: mode === "patient" ? "low" : "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      const send = (text: string) => { sent = true; controller.enqueue(encoder.encode(text)); };
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send(event.delta.text);
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !sent) send("I can't help with that one. Try rephrasing it as a study question.");
      } catch (error) {
        let msg = "Something went wrong reaching the tutor. Try again.";
        if (error instanceof Anthropic.AuthenticationError) msg = "The AI key was rejected. It may have been rotated: update ANTHROPIC_API_KEY in the Vercel project settings.";
        else if (error instanceof Anthropic.RateLimitError) msg = "The tutor is rate limited right now. Wait a few seconds and try again.";
        else if (error instanceof Anthropic.BadRequestError) msg = `The tutor request was rejected (${error.message.slice(0, 160)}).`;
        else if (error instanceof Anthropic.APIError) msg = `The tutor service returned an error (${error.status ?? "network"}). Try again.`;
        console.error("chat error", error);
        send(`${sent ? "\n\n" : ""}⚠ ${msg}`);
      } finally {
        controller.close();
      }
    },
    cancel() { stream.abort(); },
  });

  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
