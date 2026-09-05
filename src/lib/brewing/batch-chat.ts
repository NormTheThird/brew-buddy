import { logAiUsage, type AiRuntime } from "@/lib/ai/runtime";
import type { Batch, BatchCheckin, Equipment, GravityReading, Recipe } from "@/lib/db/schema";
import { fermentationDay, type NextAction } from "./schedule";

/* "Talk to this batch": Trey sends a note and usually a photo (hydrometer in
   the test jar, krausen through the fermenter wall, a bottle held to the
   light) and Claude answers IN THE CONTEXT of this batch — recipe targets,
   brew day, readings so far, schedule, and the previous exchanges.

   Claude can also PROPOSE CHANGES: log or fix a gravity reading, move or add
   a schedule task, correct a batch field. Each proposal renders as a button;
   nothing is ever applied without a click. */

/** Legacy shape stored in proposedReadingJson by v1 check-in rows. */
export type ProposedReading = { value: number; tempF?: number; stage?: string };

export type ProposedAction =
  | { kind: "add_reading"; value: number; tempF?: number; stage?: string; dateISO?: string }
  | { kind: "update_reading"; readingId: string; value?: number; tempF?: number; stage?: string; dateISO?: string }
  | { kind: "move_task"; taskKey: string; dueISO: string; label?: string }
  | { kind: "add_task"; label: string; dueISO: string }
  | { kind: "update_batch"; field: BatchField; value: string };

export const BATCH_FIELDS = [
  "og",
  "ogTempF",
  "fg",
  "fgTempF",
  "brewDate",
  "bottledDate",
  "status",
] as const;
export type BatchField = (typeof BATCH_FIELDS)[number];

export type BatchChatResult = {
  reply: string;
  actions: ProposedAction[];
};

export type TaskContext = NextAction & { done: boolean };

export type BatchChatContext = {
  batch: Batch;
  recipe?: Recipe;
  readings: GravityReading[];
  prior: BatchCheckin[];
  instrument?: Equipment;
  tasks: TaskContext[];
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type CheckinImageType = (typeof IMAGE_TYPES)[number];

export function isSupportedCheckinPhoto(mime: string): mime is CheckinImageType {
  return (IMAGE_TYPES as readonly string[]).includes(mime);
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "unknown";
}

function batchContext(ctx: BatchChatContext): string {
  const { batch, recipe, readings, prior, instrument, tasks } = ctx;
  const day = fermentationDay(batch);
  const lines: string[] = [
    `Batch #${batch.batchNumber}: ${batch.recipeName}`,
    `Status: ${batch.status}. Brew date: ${fmtDate(batch.brewDate)}.` +
      (day != null ? ` Today is fermentation day ${day}.` : ""),
  ];
  if (recipe) {
    const t: string[] = [];
    if (recipe.style) t.push(`style ${recipe.style}`);
    if (recipe.targetOG) t.push(`target OG ${recipe.targetOG.toFixed(3)}`);
    if (recipe.targetFG) t.push(`target FG ${recipe.targetFG.toFixed(3)}`);
    if (recipe.targetABV) t.push(`target ABV ${recipe.targetABV.toFixed(1)}%`);
    if (recipe.targetIBU) t.push(`target IBU ${recipe.targetIBU}`);
    if (t.length) lines.push(`Recipe: ${t.join(", ")}.`);
  }
  if (instrument?.calibrationOffset != null) {
    lines.push(
      `Hydrometer: ${instrument.name} reads ${Math.abs(instrument.calibrationOffset).toFixed(3)} ` +
        `${instrument.calibrationOffset >= 0 ? "low" : "high"}; ADD ${instrument.calibrationOffset >= 0 ? "+" : ""}${instrument.calibrationOffset.toFixed(3)} ` +
        `to every raw reading (calibrated ${fmtDate(instrument.lastCalibratedAt)}, ${instrument.calibrationTempF ?? 60}F scale). ` +
        `All gravity values below are RAW.`
    );
  }
  if (batch.og != null)
    lines.push(
      `Measured OG (raw): ${batch.og.toFixed(3)}` +
        (batch.ogTempF != null ? ` at ${batch.ogTempF}F` : "") +
        `.`
    );
  if (batch.fg != null) lines.push(`Measured FG (raw): ${batch.fg.toFixed(3)}.`);
  if (batch.pitchTempF != null) lines.push(`Pitched at ${batch.pitchTempF}F.`);
  if (readings.length) {
    lines.push("Gravity readings so far (raw values, with ids):");
    for (const r of readings) {
      lines.push(
        `- [${r.id}] ${fmtDate(r.takenAt)}: ${r.value.toFixed(3)}` +
          (r.tempF != null ? ` at ${r.tempF}F` : "") +
          (r.stage ? ` (${r.stage})` : "")
      );
    }
  }
  if (tasks.length) {
    lines.push("Schedule tasks (with keys):");
    for (const t of tasks) {
      lines.push(
        `- [${t.key}] ${t.label}: due ${fmtDate(t.due)}${t.done ? " (done)" : t.overdue ? " (overdue)" : ""}`
      );
    }
  }
  if (prior.length) {
    lines.push("", "Previous check-ins on this batch (oldest first):");
    for (const c of prior) {
      lines.push(`[${fmtDate(c.createdAt)}] Brewer: ${c.note}`);
      const reply = c.reply.length > 600 ? c.reply.slice(0, 600) + "..." : c.reply;
      lines.push(`[${fmtDate(c.createdAt)}] You answered: ${reply}`);
    }
  }
  return lines.join("\n");
}

function buildPrompt(context: string, note: string, hasPhoto: boolean): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a hands-on homebrewing assistant watching over ONE batch (today is ${today}). Here is everything known about it:

${context}

The brewer just checked in${hasPhoto ? " with the attached photo" : ""}:
"${note}"

Answer as a knowledgeable brewing friend standing next to the fermenter:
- ${hasPhoto ? "Describe what the photo actually shows first, then interpret it." : "Interpret what they report."}
- If a hydrometer or other instrument is visible, read it carefully (read the meniscus low). Apply the instrument offset and temperature correction where known, and say both raw and corrected values.
- Compare against this batch's targets and prior readings: on track, ahead, stalled, or concerning. Attenuation and estimated ABV where meaningful.
- Say what to do next and when.
- Mention anything in the photo that looks off (infection signs, oxidation risk, headspace, temperature) but do not invent problems.
- Plain text, short paragraphs, no markdown headings, no em dashes. Keep it under ~250 words.

You may also PROPOSE CHANGES to the batch's data when the brewer asks for them or they clearly follow (a reading to log, a date that is wrong, a task to move or add). Proposals are shown as buttons the brewer approves one by one, so propose exactly what they asked for, nothing speculative. Gravity values in proposals are always RAW (as the instrument showed); the app applies corrections itself.

Action kinds:
- {"kind":"add_reading","value":1.006,"tempF":70,"stage":"og|fermentation|fg","dateISO":"YYYY-MM-DD"} log a new reading (dateISO defaults to today)
- {"kind":"update_reading","readingId":"<id from the list>","value":1.006,"tempF":70,"stage":"fg","dateISO":"YYYY-MM-DD"} fix an existing reading; include only the fields to change
- {"kind":"move_task","taskKey":"<key from the list>","dueISO":"YYYY-MM-DD","label":"optional new label"} move a schedule task
- {"kind":"add_task","label":"Cold crash at 34F","dueISO":"YYYY-MM-DD"} add a task to the schedule
- {"kind":"update_batch","field":"og|ogTempF|fg|fgTempF|brewDate|bottledDate|status","value":"1.036 or YYYY-MM-DD or planned|fermenting|conditioning|completed"} correct a batch field

Return ONLY a JSON object, no other text. Escape newlines inside strings as \\n:
{
  "reply": "your answer to the brewer",
  "actions": [ ...zero or more action objects... ]
}`;
}

export async function askBatchAi(
  rt: AiRuntime,
  ctx: BatchChatContext,
  note: string,
  photo?: { bytes: Buffer; mime: CheckinImageType }
): Promise<BatchChatResult> {
  const prompt = buildPrompt(batchContext(ctx), note, Boolean(photo));
  const content: (
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: CheckinImageType; data: string } }
  )[] = [];
  if (photo) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: photo.mime, data: photo.bytes.toString("base64") },
    });
  }
  content.push({ type: "text", text: prompt });

  // Streaming, no silent retries — the recipe-lookup lesson: a killed
  // non-streaming request bills invisibly while the UI hangs.
  const stream = rt.client.messages.stream(
    {
      model: "claude-sonnet-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      messages: [{ role: "user", content }],
    },
    { timeout: 120_000, maxRetries: 0 }
  );
  const response = await stream.finalMessage();
  await logAiUsage(rt, "claude-sonnet-5", response.usage);

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to look at this check-in.");
  }
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in the model response.");
  let p: { reply?: unknown; actions?: unknown };
  try {
    p = JSON.parse(jsonMatch[0]);
  } catch {
    // The model sometimes emits real newlines inside the reply string,
    // which is invalid JSON. Escape control characters within string
    // literals only (whitespace between tokens is untouched).
    const repaired = jsonMatch[0].replace(/"(?:[^"\\]|\\[\s\S])*"/g, (s) =>
      s.replace(/\n/g, "\\n").replace(/\r/g, "").replace(/\t/g, "\\t")
    );
    p = JSON.parse(repaired);
  }

  const reply = typeof p.reply === "string" && p.reply.trim() ? p.reply.trim() : null;
  if (!reply) throw new Error("The model returned no reply text.");

  const actions: ProposedAction[] = [];
  if (Array.isArray(p.actions)) {
    for (const raw of p.actions) {
      const a = sanitizeAction(raw);
      if (a) actions.push(a);
    }
  }
  return { reply, actions: actions.slice(0, 8) };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const strv = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const dateISO = (v: unknown) => {
  const s = strv(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};
const sg = (v: unknown) => {
  const n = num(v);
  return n != null && n > 0.9 && n < 1.2 ? n : undefined;
};

function sanitizeAction(raw: unknown): ProposedAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "add_reading": {
      const value = sg(r.value);
      if (value == null) return null;
      return { kind: "add_reading", value, tempF: num(r.tempF), stage: strv(r.stage), dateISO: dateISO(r.dateISO) };
    }
    case "update_reading": {
      const readingId = strv(r.readingId);
      if (!readingId) return null;
      const a: ProposedAction = { kind: "update_reading", readingId };
      a.value = sg(r.value);
      a.tempF = num(r.tempF);
      a.stage = strv(r.stage);
      a.dateISO = dateISO(r.dateISO);
      if (a.value == null && a.tempF == null && !a.stage && !a.dateISO) return null;
      return a;
    }
    case "move_task": {
      const taskKey = strv(r.taskKey);
      const due = dateISO(r.dueISO);
      if (!taskKey || !due) return null;
      return { kind: "move_task", taskKey, dueISO: due, label: strv(r.label) };
    }
    case "add_task": {
      const label = strv(r.label);
      const due = dateISO(r.dueISO);
      if (!label || !due) return null;
      return { kind: "add_task", label, dueISO: due };
    }
    case "update_batch": {
      const field = strv(r.field) as BatchField | undefined;
      const value = strv(r.value) ?? (num(r.value) != null ? String(r.value) : undefined);
      if (!field || !BATCH_FIELDS.includes(field) || value == null) return null;
      return { kind: "update_batch", field, value };
    }
    default:
      return null;
  }
}

/** One human line per action, for the Apply button row. */
export function describeAction(a: ProposedAction): string {
  switch (a.kind) {
    case "add_reading":
      return `Log reading ${a.value.toFixed(3)}${a.tempF != null ? ` at ${a.tempF}F` : ""}${a.stage ? ` (${a.stage})` : ""}${a.dateISO ? ` on ${a.dateISO}` : ""}`;
    case "update_reading": {
      const parts = [
        a.value != null ? `value ${a.value.toFixed(3)}` : null,
        a.tempF != null ? `${a.tempF}F` : null,
        a.stage ? `stage ${a.stage}` : null,
        a.dateISO ? `date ${a.dateISO}` : null,
      ].filter(Boolean);
      return `Fix reading: ${parts.join(", ")}`;
    }
    case "move_task":
      return `Move "${a.label ?? a.taskKey}" to ${a.dueISO}`;
    case "add_task":
      return `Add task "${a.label}" on ${a.dueISO}`;
    case "update_batch":
      return `Set ${a.field} to ${a.value}`;
  }
}
