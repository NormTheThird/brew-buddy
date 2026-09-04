import { logAiUsage, type AiRuntime } from "@/lib/ai/runtime";
import type { Batch, BatchCheckin, GravityReading, Recipe } from "@/lib/db/schema";
import { fermentationDay } from "./schedule";

/* "Talk to this batch": Trey sends a note and usually a photo (hydrometer in
   the test jar, krausen through the fermenter wall, a bottle held to the
   light) and Claude answers IN THE CONTEXT of this batch — recipe targets,
   brew day, readings so far, and the previous exchanges. If the photo shows
   an instrument reading, Claude also returns it structured so one click can
   log it as a real gravity reading. */

export type ProposedReading = {
  value: number; // raw hydrometer reading as seen, e.g. 1.014
  tempF?: number;
  stage?: string; // og | fermentation | fg
};

export type BatchChatResult = {
  reply: string;
  reading?: ProposedReading;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type CheckinImageType = (typeof IMAGE_TYPES)[number];

export function isSupportedCheckinPhoto(mime: string): mime is CheckinImageType {
  return (IMAGE_TYPES as readonly string[]).includes(mime);
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "unknown";
}

function batchContext(
  batch: Batch,
  recipe: Recipe | undefined,
  readings: GravityReading[],
  prior: BatchCheckin[]
): string {
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
  if (batch.og != null)
    lines.push(
      `Measured OG: ${batch.og.toFixed(3)}` +
        (batch.ogTempF != null ? ` at ${batch.ogTempF}F` : "") +
        `.`
    );
  if (batch.fg != null) lines.push(`Measured FG: ${batch.fg.toFixed(3)}.`);
  if (batch.pitchTempF != null) lines.push(`Pitched at ${batch.pitchTempF}F.`);
  if (readings.length) {
    lines.push("Gravity readings so far:");
    for (const r of readings) {
      lines.push(
        `- ${fmtDate(r.takenAt)}: ${r.value.toFixed(3)}` +
          (r.tempF != null ? ` at ${r.tempF}F` : "") +
          (r.stage ? ` (${r.stage})` : "")
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
  return `You are a hands-on homebrewing assistant watching over ONE batch. Here is everything known about it:

${context}

The brewer just checked in${hasPhoto ? " with the attached photo" : ""}:
"${note}"

Answer as a knowledgeable brewing friend standing next to the fermenter:
- ${hasPhoto ? "Describe what the photo actually shows first, then interpret it." : "Interpret what they report."}
- If a hydrometer or other instrument is visible, read it carefully (read the meniscus low). Apply temperature correction when a sample temperature is known or visible, and say both raw and corrected values.
- Compare against this batch's targets and prior readings: on track, ahead, stalled, or concerning. Attenuation and estimated ABV where meaningful.
- Say what to do next and when (e.g. "take another reading in 3 days; if it is still 1.014 it is done").
- Mention anything in the photo that looks off (infection signs, oxidation risk, headspace, temperature) but do not invent problems.
- Plain text, short paragraphs, no markdown headings, no em dashes. Keep it under ~250 words.

Return ONLY a JSON object, no other text. Escape newlines inside strings as \\n:
{
  "reply": "your answer to the brewer",
  "reading": { "value": 1.014, "tempF": 68, "stage": "fermentation" } or null
}
"reading" is ONLY for a number you actually read off an instrument in the photo (raw, uncorrected). Use stage "og" before/at pitch, "fg" if fermentation looks finished, else "fermentation". Omit tempF unless a thermometer value is visible or stated. If there is no instrument in the photo, or no photo, reading is null.`;
}

export async function askBatchAi(
  rt: AiRuntime,
  batch: Batch,
  recipe: Recipe | undefined,
  readings: GravityReading[],
  prior: BatchCheckin[],
  note: string,
  photo?: { bytes: Buffer; mime: CheckinImageType }
): Promise<BatchChatResult> {
  const prompt = buildPrompt(batchContext(batch, recipe, readings, prior), note, Boolean(photo));
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
  let p: { reply?: unknown; reading?: unknown };
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

  let reading: ProposedReading | undefined;
  if (p.reading && typeof p.reading === "object") {
    const r = p.reading as Record<string, unknown>;
    const value = typeof r.value === "number" && r.value > 0.9 && r.value < 1.2 ? r.value : null;
    if (value != null) {
      reading = {
        value,
        tempF: typeof r.tempF === "number" && Number.isFinite(r.tempF) ? r.tempF : undefined,
        stage: typeof r.stage === "string" && r.stage.trim() ? r.stage.trim() : undefined,
      };
    }
  }
  return { reply, reading };
}
