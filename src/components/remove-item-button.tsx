"use client";

import { removePurchaseItem } from "@/lib/purchases/actions";

export function RemoveItemButton({
  kind,
  itemId,
  purchaseId,
  name,
}: {
  kind: "equipment" | "ingredient";
  itemId: string;
  purchaseId: string;
  name: string;
}) {
  return (
    <form
      action={removePurchaseItem}
      onSubmit={(e) => {
        if (!window.confirm(`Remove "${name}" from your inventory? This deletes the item row.`)) {
          e.preventDefault();
        }
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <button
        type="submit"
        style={{
          background: "none",
          border: "none",
          color: "var(--danger)",
          cursor: "pointer",
          fontSize: 12,
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        remove
      </button>
    </form>
  );
}
