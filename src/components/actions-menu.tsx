"use client";

import { useEffect, useRef, useState } from "react";

/** A button-looking "Actions ▾" dropdown for page headers: pass menu items
    as children (Links or forms styled with .menu-item). Keeps destructive
    actions one deliberate step away instead of naked in the header. */
export function ActionsMenu({
  label = "Actions",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
        {label}{" "}
        <span style={{ fontSize: 10, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▼
        </span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "var(--chrome)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            minWidth: 170,
            zIndex: 50,
            boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
            padding: "6px 0",
          }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
