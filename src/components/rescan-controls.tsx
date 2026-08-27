"use client";

import { useActionState } from "react";
import { rescanReceipt, type FormState } from "@/lib/purchases/actions";

export function RescanControls({ purchaseId }: { purchaseId: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    rescanReceipt,
    {}
  );

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        borderTop: "1px solid var(--border-row)",
        paddingTop: 12,
        marginTop: 12,
      }}
    >
      <input type="hidden" name="id" value={purchaseId} />
      <input
        name="hint"
        className="field"
        placeholder='Not quite right? Tell it what to fix — e.g. "you missed the bottle capper and caps"'
        style={{ flex: 1, minWidth: 240 }}
      />
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Rescanning…" : "Rescan with AI"}
      </button>
      {pending ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          builds on the previous read + your note
        </span>
      ) : null}
      {state.error ? (
        <span style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</span>
      ) : null}
    </form>
  );
}
