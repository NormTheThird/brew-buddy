"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* Live search: starts filtering at 3+ characters (debounced), clears when
   emptied. Filtering happens server-side via the URL, so results stay
   shareable and back-button friendly. */
export function PurchaseSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = params.get("q") ?? "";
    const next = value.trim();
    const effective = next.length >= 3 ? next : "";
    if (effective === current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (effective) sp.set("q", effective);
      else sp.delete("q");
      sp.delete("page"); // new search starts at page 1
      const s = sp.toString();
      router.replace(s ? `/purchases?${s}` : "/purchases");
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, params, router]);

  return (
    <input
      name="q"
      className="field"
      placeholder="Type 3+ letters to filter — name, vendor, order #, notes…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ maxWidth: 380 }}
    />
  );
}
