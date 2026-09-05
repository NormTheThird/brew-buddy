"use client";

import { useState } from "react";
import { abv, apparentAttenuation, correctForTemperature } from "@/lib/calc/gravity";

/* Client-side gravity calculator — same pure functions the server uses.
   Offset convention: ADDED to the raw reading (an instrument showing 0.995
   in calibration-temp water has offset +0.005). When a calibrated
   instrument exists its offset is prefilled. */
export function GravityCalc({
  og,
  defaultOffset,
  instrumentName,
  calibrationTempF,
}: {
  og?: number | null;
  defaultOffset?: number | null;
  instrumentName?: string | null;
  calibrationTempF?: number | null;
}) {
  const [reading, setReading] = useState("");
  const [tempF, setTempF] = useState("");
  const [offset, setOffset] = useState(defaultOffset != null ? String(defaultOffset) : "0");

  const r = Number(reading);
  const t = Number(tempF);
  const o = Number(offset);
  const calT = calibrationTempF ?? 60;
  const valid = Number.isFinite(r) && r > 0.9 && r < 1.2;
  const corrected = valid
    ? (() => {
        const withOffset = r + (Number.isFinite(o) ? o : 0);
        return Number.isFinite(t) && t > 0
          ? correctForTemperature(withOffset, t, calT)
          : withOffset;
      })()
    : null;
  const abvVal = corrected != null && og != null ? abv(og, corrected) : null;
  const atten = corrected != null && og != null && og > 1 ? apparentAttenuation(og, corrected) : null;

  return (
    <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label className="field-label" htmlFor="gc-reading">Reading</label>
          <input id="gc-reading" className="field" inputMode="decimal" placeholder="1.034" value={reading} onChange={(e) => setReading(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="gc-temp">Sample °F</label>
          <input id="gc-temp" className="field" inputMode="decimal" placeholder="60" value={tempF} onChange={(e) => setTempF(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="gc-offset">Instrument offset</label>
          <input id="gc-offset" className="field" inputMode="decimal" value={offset} onChange={(e) => setOffset(e.target.value)} />
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-row)", paddingTop: 10, display: "flex", gap: 26, alignItems: "baseline", flexWrap: "wrap" }}>
        <span>
          <span className="field-label" style={{ marginBottom: 0 }}>Corrected </span>
          <span style={{ color: "var(--text-bright)", fontSize: 20, fontWeight: 300 }}>
            {corrected != null ? corrected.toFixed(3) : "—"}
          </span>
        </span>
        {og != null ? (
          <>
            <span style={{ fontSize: 13 }}>
              vs OG {og.toFixed(3)} → ABV{" "}
              <span style={{ color: "var(--text-bright)" }}>{abvVal != null ? `${abvVal.toFixed(1)}%` : "—"}</span>
            </span>
            <span style={{ fontSize: 13 }}>
              attenuation{" "}
              <span style={{ color: "var(--text-bright)" }}>{atten != null ? `${atten.toFixed(0)}%` : "—"}</span>
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Set the batch OG to see ABV.</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
        {instrumentName && defaultOffset != null
          ? `Standard cubic correction, ${calT}°F calibration. Offset ${defaultOffset >= 0 ? "+" : ""}${defaultOffset.toFixed(3)} prefilled from ${instrumentName}'s water test; the offset is added to the raw reading.`
          : "Standard cubic correction, 60°F calibration. Offset comes from reading RO water at calibration temp; calibrate your hydrometer on its Equipment page to prefill it."}
      </div>
    </div>
  );
}
