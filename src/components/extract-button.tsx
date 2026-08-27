"use client";

import { useActionState } from "react";
import { runReceiptExtraction, type FormState } from "@/lib/purchases/actions";

export function ExtractButton({ purchaseId }: { purchaseId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    runReceiptExtraction,
    {}
  );

  return (
    <form action={formAction} className="form-stack gap-sm">
      <input type="hidden" name="id" value={purchaseId} />
      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? "Reading receipt…" : "Read receipt with AI"}
      </button>
      {pending ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Claude is reading the receipt, usually 10–30 seconds.
        </div>
      ) : null}
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div>
      ) : null}
    </form>
  );
}
