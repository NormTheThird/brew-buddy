"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { askBatch, logCheckinReading, type BatchChatState } from "@/lib/brewing/actions";

/** Serialized check-in for the client (dates as preformatted strings). */
export type CheckinView = {
  id: string;
  note: string;
  reply: string;
  when: string;
  hasPhoto: boolean;
  proposal: { value: number; tempF?: number; stage?: string } | null;
  logged: boolean;
};

/** "Talk to this batch": running conversation plus the ask box. A photo is
    optional but the point — hydrometer in the jar, krausen, a pour. */
export function BatchChat({ batchId, checkins }: { batchId: string; checkins: CheckinView[] }) {
  const [state, formAction, pending] = useActionState<BatchChatState, FormData>(askBatch, {});
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div className="panel-heading" style={{ padding: 0, marginBottom: 6 }}>
        Talk to this batch
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Snap the hydrometer, the krausen, a pour. Claude answers with this
        batch&apos;s recipe, day, and readings in mind, and can log what it reads.
      </div>

      {checkins.map((c) => (
        <div
          key={c.id}
          style={{ borderTop: "1px solid var(--border-row)", padding: "12px 0", fontSize: 13 }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>You</span>
            <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{c.when}</span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", margin: "4px 0 8px" }}>{c.note}</div>
          {c.hasPhoto ? (
            <a href={`/batches/checkins/${c.id}/photo`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/batches/checkins/${c.id}/photo`}
                alt="check-in photo"
                style={{ maxWidth: 180, maxHeight: 180, borderRadius: 4, display: "block", marginBottom: 8 }}
              />
            </a>
          ) : null}
          <div style={{ color: "var(--accent)", fontWeight: 500 }}>Claude</div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 4, color: "var(--text-bright)" }}>
            {c.reply}
          </div>
          {c.proposal ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Read from photo: {c.proposal.value.toFixed(3)}
                {c.proposal.tempF != null ? ` at ${c.proposal.tempF}F` : ""}
                {c.proposal.stage ? ` (${c.proposal.stage})` : ""}
              </span>
              {c.logged ? (
                <span style={{ color: "var(--success)", fontSize: 12 }}>logged ✓</span>
              ) : (
                <form action={logCheckinReading} className="form-inline">
                  <input type="hidden" name="checkinId" value={c.id} />
                  <button type="submit" className="btn" style={{ padding: "2px 12px", fontSize: 12 }}>
                    Log this reading
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      ))}

      {/* never style a form element inline — house rule */}
      <form action={formAction} className="form-stack gap-sm">
        <div style={{ borderTop: checkins.length ? "1px solid var(--border-row)" : "none", paddingTop: 12 }}>
          <textarea
            name="note"
            className="field"
            rows={2}
            required
            placeholder='What&apos;s happening? e.g. "Day 10 gravity reading, does this look done?"'
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>
        <input type="hidden" name="batchId" value={batchId} />
        <div className="form-row">
          <input
            ref={fileRef}
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="field"
            style={{ flex: 1, minWidth: 200, padding: 6 }}
          />
          <button type="submit" className="btn btn-solid" disabled={pending}>
            {pending ? "Claude is looking…" : "Ask Claude"}
          </button>
        </div>
        {pending ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Reading the photo against this batch&apos;s history; usually 10 to 30 seconds.
          </div>
        ) : null}
        {state.error ? (
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div>
        ) : null}
      </form>
    </div>
  );
}
