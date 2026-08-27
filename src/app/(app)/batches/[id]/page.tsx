import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, batchIngredients, gravityReadings, purchases, stock } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  addGravityReading,
  deleteBatch,
  deleteBatchIngredient,
  deleteGravityReading,
  useBottlingSupplies,
  useStockInBatch,
} from "@/lib/brewing/actions";
import { isEstimated, batchStatusBadge, methodLabels } from "@/lib/brewing/display";
import { abv, apparentAttenuation, correctForTemperature } from "@/lib/calc/gravity";
import { PageHeader } from "@/components/page-header";
import { LayersIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";
import { GravityCalc } from "@/components/gravity-calc";

function Chip({ batch, field }: { batch: Parameters<typeof isEstimated>[0]; field: string }) {
  return isEstimated(batch, field) ? (
    <span className="chip-estimate">EST</span>
  ) : (
    <span className="chip-measured">M</span>
  );
}

function Row({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border-row)", fontSize: 13 }}>
        <span>{label}</span>
        <span style={{ color: "var(--text-bright)", display: "flex", alignItems: "center", gap: 8 }}>{children}</span>
      </div>
      {sub ? <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4 }}>{sub}</div> : null}
    </>
  );
}

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;

  const b = db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.userId, user.id)))
    .all()[0];
  if (!b) notFound();

  const ingredientRows = db
    .select()
    .from(batchIngredients)
    .where(eq(batchIngredients.batchId, b.id))
    .all();
  const readings = db
    .select()
    .from(gravityReadings)
    .where(eq(gravityReadings.batchId, b.id))
    .all()
    .sort((a, c) => a.takenAt.getTime() - c.takenAt.getTime());

  // What the batch cost: each snapshot line looks up its lot's price. A lot
  // only partially used is prorated by amount/lot quantity (same unit). Kit
  // components have no line price by design — they're flagged, never faked.
  const lotIds = ingredientRows
    .map((ir) => ir.ingredientId)
    .filter((v): v is string => v != null);
  const lots = lotIds.length
    ? db.select().from(stock).where(inArray(stock.id, lotIds)).all()
    : [];
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const kitPurchaseIds = [
    ...new Set(
      lots.filter((l) => l.cost == null && l.purchaseId).map((l) => l.purchaseId!)
    ),
  ];
  const kitNames = kitPurchaseIds.length
    ? new Map(
        db
          .select({ id: purchases.id, name: purchases.name })
          .from(purchases)
          .where(inArray(purchases.id, kitPurchaseIds))
          .all()
          .map((p) => [p.id, p.name] as const)
      )
    : new Map<string, string>();

  const costOfLine = (ir: (typeof ingredientRows)[number]) => {
    const lot = ir.ingredientId ? lotById.get(ir.ingredientId) : undefined;
    if (!lot) return { kind: "unknown" as const };
    if (lot.cost == null) {
      return lot.purchaseId && kitNames.has(lot.purchaseId)
        ? { kind: "kit" as const, kit: kitNames.get(lot.purchaseId)! }
        : { kind: "unknown" as const };
    }
    if (
      ir.amount != null &&
      lot.quantity != null &&
      lot.quantity > 0 &&
      (ir.unit ?? "") === (lot.unit ?? "")
    ) {
      const ratio = Math.min(1, ir.amount / lot.quantity);
      return { kind: "priced" as const, cost: lot.cost * ratio, prorated: ratio < 1 };
    }
    return { kind: "priced" as const, cost: lot.cost, prorated: false };
  };
  const lineCosts = ingredientRows.map(costOfLine);
  const knownCost = lineCosts.reduce(
    (s, c) => s + (c.kind === "priced" ? c.cost : 0),
    0
  );
  const pricedCount = lineCosts.filter((c) => c.kind === "priced").length;
  const kitCount = lineCosts.filter((c) => c.kind === "kit").length;

  // Lots the batch can draw from: anything on hand, plus water (unlimited).
  const usableLots = db
    .select()
    .from(stock)
    .where(eq(stock.userId, user.id))
    .all()
    .filter((l) => l.quantityOnHand > 0 || l.type === "water")
    .sort((a, c) => a.type.localeCompare(c.type) || a.name.localeCompare(c.name));
  const lotLabel = (l: (typeof usableLots)[number]) =>
    `${l.name}${l.lotNumber ? ` · lot ${l.lotNumber}` : ""} · ${
      l.type === "water" ? "unlimited" : `${l.quantityOnHand} ${l.unit ?? "ct"} on hand`
    }`;

  // Bottling helper guesses — transparent prefills, never silent deductions.
  const guessBottles = usableLots.find(
    (l) => l.type === "supply" && /bottle/i.test(l.name) && !/cap/i.test(l.name)
  );
  const guessCaps = usableLots.find((l) => l.type === "supply" && /cap/i.test(l.name));
  const guessSugar = usableLots.find(
    (l) => l.type === "adjunct" && /priming|sugar/i.test(l.name)
  );
  const bottlingGuesses = [
    { key: "bottles", label: "Bottles", lot: guessBottles, amount: b.bottleCount ?? 48 },
    { key: "caps", label: "Caps", lot: guessCaps, amount: b.bottleCount ?? 48 },
    { key: "sugar", label: "Priming sugar", lot: guessSugar, amount: 1 },
  ].filter((g) => g.lot);

  const badge = batchStatusBadge[b.status];
  const abvVal = b.og != null && b.fg != null ? abv(b.og, b.fg) : null;
  const atten = b.og != null && b.fg != null && b.og > 1 ? apparentAttenuation(b.og, b.fg) : null;
  const boilOff =
    b.preBoilVolumeGal != null && b.postBoilVolumeGal != null && b.boilMinutes
      ? (b.preBoilVolumeGal - b.postBoilVolumeGal) / (b.boilMinutes / 60)
      : null;
  const kettleLoss =
    b.postBoilVolumeGal != null && b.intoFermenterGal != null
      ? b.postBoilVolumeGal - b.intoFermenterGal
      : null;

  return (
    <>
      <PageHeader
        icon={<LayersIcon size={40} />}
        title={`Batch #${b.batchNumber} · ${b.recipeName}`}
        subtitle={[
          b.brewDate ? `Brewed ${b.brewDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : null,
          methodLabels[b.method],
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <span className="badge" style={{ background: badge.color, alignSelf: "center" }}>{badge.label}</span>
            {b.keeper ? <span className="badge" style={{ background: "var(--success)", alignSelf: "center" }}>KEEPER</span> : null}
            <Link href={`/batches/${b.id}/edit`} className="btn">Edit</Link>
            <DeleteButton action={deleteBatch} id={b.id} label="Delete" confirmText={`Delete batch #${b.batchNumber}? Readings go with it.`} />
          </>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16, alignItems: "start" }}>
        <div className="panel">
          <div className="panel-heading">Volumes</div>
          <div className="panel-body">
            <Row label="Pre-boil">
              {b.preBoilVolumeGal != null ? <>{b.preBoilVolumeGal} gal <Chip batch={b} field="preBoilVolumeGal" /></> : <span style={{ color: "var(--danger)" }}>not captured</span>}
            </Row>
            <Row label="Post-boil">
              {b.postBoilVolumeGal != null ? <>{b.postBoilVolumeGal} gal <Chip batch={b} field="postBoilVolumeGal" /></> : <span style={{ color: "var(--danger)" }}>not captured</span>}
            </Row>
            {b.postBoilVolumeGal == null ? (
              <div style={{ background: "rgba(219,82,75,.1)", borderLeft: "3px solid var(--danger)", padding: "8px 10px", fontSize: 12, margin: "6px 0" }}>
                Post-boil volume feeds boil-off and kettle loss. Capture it next brew.
              </div>
            ) : null}
            <Row label="Into fermenter">
              {b.intoFermenterGal != null ? <>{b.intoFermenterGal} gal <Chip batch={b} field="intoFermenterGal" /></> : "—"}
            </Row>
            {boilOff != null ? <Row label="→ Boil-off rate">{boilOff.toFixed(2)} gal/hr</Row> : null}
            {kettleLoss != null ? <Row label="→ Kettle loss">{kettleLoss.toFixed(2)} gal</Row> : null}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Gravity</div>
          <div className="panel-body">
            <Row label="OG" sub={b.ogTempF != null ? `sample at ${b.ogTempF}°F, corrected` : undefined}>
              {b.og != null ? <>{b.og.toFixed(3)} <Chip batch={b} field="og" /></> : "—"}
            </Row>
            <Row label="FG" sub={b.fgTempF != null ? `sample at ${b.fgTempF}°F, corrected` : undefined}>
              {b.fg != null ? <>{b.fg.toFixed(3)} <Chip batch={b} field="fg" /></> : "pending"}
            </Row>
            <Row label="ABV">{abvVal != null ? `${abvVal.toFixed(1)}%` : "needs OG + FG"}</Row>
            <Row label="Attenuation">{atten != null ? `${atten.toFixed(0)}%` : "—"}</Row>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Process</div>
          <div className="panel-body">
            <Row label="Steep">{b.steepTempF != null || b.steepMinutes != null ? `${b.steepTempF ?? "—"}°F · ${b.steepMinutes ?? "—"} min` : "—"}</Row>
            <Row label="Heat to boil">{b.timeToBoilMinutes != null ? `${b.timeToBoilMinutes} min` : "—"}</Row>
            <Row label="Boil">{b.boilMinutes != null ? `${b.boilMinutes} min` : "—"}</Row>
            <Row label="Chill">{b.timeToChillMinutes != null || b.chillEndTempF != null ? `${b.timeToChillMinutes ?? "—"} min → ${b.chillEndTempF ?? "—"}°F` : "—"}</Row>
            <Row label="Pitch temp">
              {b.pitchTempF != null ? (
                <>
                  {b.pitchTempF}°F <Chip batch={b} field="pitchTempF" />
                  {b.pitchTempF > 72 ? <span className="badge" style={{ background: "var(--warning)" }}>ABOVE 72°F LIMIT</span> : null}
                </>
              ) : "—"}
            </Row>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Ingredients as brewed</div>
          <div className="panel-body">
            {ingredientRows.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No snapshot recorded.</div>
            ) : (
              <>
                {ingredientRows.map((ir, i) => {
                  const c = lineCosts[i];
                  return (
                    <Row key={ir.id} label={ir.description}>
                      {ir.amount != null ? `${ir.amount} ${ir.unit ?? ""}` : ""}
                      {ir.timingMinutes != null ? ` · ${ir.timingMinutes} min` : ""}
                      {c.kind === "priced" ? (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          ${c.cost.toFixed(2)}
                          {c.prorated ? " of lot" : ""}
                        </span>
                      ) : c.kind === "kit" ? (
                        <span style={{ color: "var(--text-faint)", fontSize: 12 }} title={`Part of ${c.kit}: no line price`}>
                          kit
                        </span>
                      ) : null}
                      <form action={deleteBatchIngredient} className="form-inline">
                        <input type="hidden" name="id" value={ir.id} />
                        <input type="hidden" name="batchId" value={b.id} />
                        <button
                          type="submit"
                          title="Remove this line. Stock is NOT refunded; fix counts on the Stock page"
                          style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "inherit" }}
                        >
                          remove
                        </button>
                      </form>
                    </Row>
                  );
                })}
                {pricedCount > 0 || kitCount > 0 ? (
                  <Row label="Batch cost (ingredients)">
                    <span>
                      {pricedCount > 0 ? `$${knownCost.toFixed(2)}` : null}
                      {kitCount > 0 ? (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {pricedCount > 0 ? " + " : ""}
                          {kitCount} kit-priced item{kitCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </Row>
                ) : null}
              </>
            )}
            {usableLots.length > 0 ? (
              <form action={useStockInBatch}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr auto auto", gap: 8, alignItems: "end", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-row)" }}>
                <input type="hidden" name="batchId" value={b.id} />
                <div>
                  <label className="field-label" htmlFor="use-lot">Use from stock (deducts on hand)</label>
                  <select id="use-lot" name="lotId" className="field" required>
                    {usableLots.map((l) => (
                      <option key={l.id} value={l.id}>{lotLabel(l)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="use-amount">Amount</label>
                  <input id="use-amount" name="amount" type="number" step="any" min="0" className="field" style={{ width: 90 }} required />
                </div>
                <button type="submit" className="btn" style={{ height: 38 }}>Use</button>
                </div>
              </form>
            ) : null}
            {b.bottleCount != null && bottlingGuesses.length > 0 ? (
              <form action={useBottlingSupplies}><div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="hidden" name="batchId" value={b.id} />
                <div className="field-label" style={{ marginBottom: 0 }}>
                  Bottling day: one submit deducts it all (clear a row to skip it)
                </div>
                {bottlingGuesses.map((g) => (
                  <div key={g.key} style={{ display: "grid", gridTemplateColumns: "90px 2fr auto", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13 }}>{g.label}</span>
                    <select name={`lot_${g.key}`} className="field" defaultValue={g.lot!.id}>
                      <option value="">— skip</option>
                      {usableLots
                        .filter((l) => l.type === g.lot!.type)
                        .map((l) => (
                          <option key={l.id} value={l.id}>{lotLabel(l)}</option>
                        ))}
                    </select>
                    <input
                      name={`amount_${g.key}`}
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={g.amount}
                      className="field"
                      style={{ width: 90 }}
                    />
                  </div>
                ))}
                <button type="submit" className="btn" style={{ alignSelf: "flex-start" }}>
                  Deduct bottling supplies
                </button>
              </div></form>
            ) : null}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Gravity readings</div>
          <div className="panel-body">
            {readings.length > 0 ? (
              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table className="data">
                  <thead><tr><th>When</th><th>Raw</th><th>°F</th><th>Corrected</th><th>Stage</th><th></th></tr></thead>
                  <tbody>
                    {readings.map((r) => (
                      <tr key={r.id}>
                        <td>{r.takenAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</td>
                        <td>{r.value.toFixed(3)}</td>
                        <td>{r.tempF ?? "—"}</td>
                        <td style={{ color: "var(--text-bright)" }}>
                          {(r.tempF != null ? correctForTemperature(r.value, r.tempF) : r.value).toFixed(3)}
                        </td>
                        <td>{r.stage ?? "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          <form action={deleteGravityReading} className="form-inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="batchId" value={b.id} />
                            <button type="submit" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <form action={addGravityReading}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <input type="hidden" name="batchId" value={b.id} />
              <div>
                <label className="field-label" htmlFor="gr-value">Raw reading</label>
                <input id="gr-value" name="value" type="number" step="0.001" className="field" required />
              </div>
              <div>
                <label className="field-label" htmlFor="gr-temp">Sample °F</label>
                <input id="gr-temp" name="tempF" type="number" step="1" className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="gr-date">Date</label>
                <input id="gr-date" name="takenAt" type="date" className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="gr-stage">Stage</label>
                <select id="gr-stage" name="stage" className="field">
                  {["fermentation", "og", "fg"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button type="submit" className="btn" style={{ height: 38 }}>Add</button>
            </div></form>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>
              Bottling gate (v3): two matching readings before you&apos;re allowed to bottle.
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Gravity quick calc</div>
          <GravityCalc og={b.og} />
        </div>
      </div>
      {b.notes || b.deviations ? (
        <div className="panel" style={{ borderLeft: "3px solid var(--accent)", marginTop: 16 }}>
          <div className="panel-body" style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6, paddingTop: 12 }}>
            {b.notes ? <div>{b.notes}</div> : null}
            {b.deviations ? <div style={{ color: "var(--text-muted)" }}>Deviations: {b.deviations}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
