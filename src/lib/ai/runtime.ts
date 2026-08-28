import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";

/* One place for every AI call's plumbing: which key runs the call (the
   user's own, else the house key), and metering of what it cost. This is
   the foundation of the BYOK-free / hosted-paid split: BYOK users burn
   their own key; hosted users burn the house key and their usage rows are
   what future caps meter against. */

const ALG = "aes-256-gcm";

function secretKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set; cannot handle stored API keys.");
  return crypto.createHash("sha256").update(secret).digest();
}

/** AES-256-GCM, output base64(iv | tag | ciphertext). Keys are secrets:
    encrypted at rest, decrypted only server-side, never sent to a client. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export type AiUser = { id: string; anthropicApiKey: string | null };

export type AiRuntime = {
  client: Anthropic;
  userId: string;
  feature: string;
  /** Whose money the call burns. */
  source: "byok" | "house";
};

export function userHasAiAccess(user: AiUser): boolean {
  return Boolean(user.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
}

export function aiRuntime(user: AiUser, feature: string): AiRuntime {
  if (user.anthropicApiKey) {
    return {
      client: new Anthropic({ apiKey: decryptSecret(user.anthropicApiKey) }),
      userId: user.id,
      feature,
      source: "byok",
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("No API key available: set your own key in My settings.");
  }
  return { client: new Anthropic(), userId: user.id, feature, source: "house" };
}

/* Rough per-model pricing in USD per million tokens — for METERING and caps,
   not invoices. Cache reads bill at ~10% of input; web searches ~$10/1k. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-5": { input: 5, output: 25 },
};

export function estimateCostUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null },
  webSearches = 0
): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-5"];
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (
    ((usage.input_tokens - 0) / 1e6) * p.input +
    (cacheRead / 1e6) * p.input * 0.1 +
    (usage.output_tokens / 1e6) * p.output +
    webSearches * 0.01
  );
}

/** Log one API response's usage. Never throws: metering must not break the
    feature it measures. */
export async function logAiUsage(
  rt: AiRuntime,
  model: string,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null },
  webSearches = 0
): Promise<void> {
  try {
    await db.insert(aiUsage).values({
      userId: rt.userId,
      feature: rt.feature,
      model,
      source: rt.source,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      webSearches,
      estCostUsd: Math.round(estimateCostUsd(model, usage, webSearches) * 10000) / 10000,
    });
  } catch (e) {
    console.error("[ai-usage] failed to log:", e);
  }
}
