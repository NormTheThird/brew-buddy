/* Gravity calculations — brief §4. Pure functions, no I/O. */

/** ABV from original and final gravity: (OG − FG) × 131.25 */
export function abv(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

/** Apparent attenuation in percent: (OG − FG) / (OG − 1.000) × 100 */
export function apparentAttenuation(og: number, fg: number): number {
  if (og <= 1.0) throw new Error("OG must be above 1.000");
  return ((og - fg) / (og - 1.0)) * 100;
}

/**
 * Correct a hydrometer reading for sample temperature (°F), using the
 * standard cubic wort-density correction relative to the instrument's
 * calibration temperature (default 60°F).
 */
export function correctForTemperature(
  reading: number,
  sampleTempF: number,
  calibrationTempF = 60
): number {
  const density = (f: number) =>
    1.00130346 -
    1.34722124e-4 * f +
    2.04052596e-6 * f * f -
    2.32820948e-9 * f * f * f;
  return reading * (density(sampleTempF) / density(calibrationTempF));
}

/**
 * Apply a per-instrument offset from a water-at-calibration-temp test.
 * Convention (matches the stored equipment.calibrationOffset): the offset is
 * ADDED to every raw reading. A hydrometer showing 0.995 in 60°F RO water
 * reads 5 points low, so its offset is +0.005.
 */
export function applyInstrumentOffset(reading: number, offset: number): number {
  return reading + offset;
}

/** The full correction an instrument-aware display uses: raw + instrument
    offset, then temperature vs the scale's calibration temp. Raw readings
    are stored untouched; this always runs at display time. */
export function correctedSg(
  raw: number,
  sampleTempF: number | null,
  instrument?: { calibrationOffset: number | null; calibrationTempF: number | null } | null
): number {
  const offset = instrument?.calibrationOffset ?? 0;
  const calTemp = instrument?.calibrationTempF ?? 60;
  const withOffset = raw + offset;
  return sampleTempF != null
    ? correctForTemperature(withOffset, sampleTempF, calTemp)
    : withOffset;
}

/** Gravity points from fermentables: Σ(lbs × PPG) / volumeGal (brief §4). */
export function gravityPoints(
  fermentables: Array<{ lbs: number; ppg: number }>,
  volumeGal: number
): number {
  if (volumeGal <= 0) throw new Error("Volume must be positive");
  const points = fermentables.reduce((sum, f) => sum + f.lbs * f.ppg, 0);
  return points / volumeGal;
}

/** Predicted gravity (1.0XX) from fermentables and volume. */
export function predictedGravity(
  fermentables: Array<{ lbs: number; ppg: number }>,
  volumeGal: number
): number {
  return 1 + gravityPoints(fermentables, volumeGal) / 1000;
}
