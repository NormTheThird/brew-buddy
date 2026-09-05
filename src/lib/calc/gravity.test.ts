import { describe, expect, it } from "vitest";
import {
  abv,
  apparentAttenuation,
  applyInstrumentOffset,
  correctForTemperature,
  gravityPoints,
  predictedGravity,
} from "./gravity";

describe("abv", () => {
  it("computes the brief's formula (OG − FG) × 131.25", () => {
    expect(abv(1.044, 1.009)).toBeCloseTo(4.59, 2);
  });

  it("matches batch 1's projection: 1.036 → 1.009 ≈ 3.5%", () => {
    expect(abv(1.036, 1.009)).toBeCloseTo(3.54, 2);
  });
});

describe("apparentAttenuation", () => {
  it("computes (OG − FG) / (OG − 1.000) × 100", () => {
    expect(apparentAttenuation(1.036, 1.009)).toBeCloseTo(75, 0);
  });

  it("rejects an OG at or below 1.000", () => {
    expect(() => apparentAttenuation(1.0, 0.998)).toThrow();
  });
});

describe("correctForTemperature", () => {
  it("returns the reading unchanged at calibration temperature", () => {
    expect(correctForTemperature(1.034, 60)).toBeCloseTo(1.034, 6);
  });

  it("corrects upward for a sample warmer than calibration", () => {
    const corrected = correctForTemperature(1.034, 95);
    expect(corrected).toBeGreaterThan(1.034);
    // Standard cubic correction at 95°F is ≈ +0.005.
    expect(corrected).toBeCloseTo(1.039, 3);
  });

  it("corrects downward for a sample colder than calibration", () => {
    expect(correctForTemperature(1.04, 45)).toBeLessThan(1.04);
  });

  it("respects a non-60°F calibration temperature", () => {
    expect(correctForTemperature(1.05, 68, 68)).toBeCloseTo(1.05, 6);
  });
});

describe("applyInstrumentOffset", () => {
  // Convention: the offset is ADDED. An instrument showing 0.995 in 60°F
  // water reads low; its offset is +0.005 (Trey's SOLIGT calibration).
  it("adds the offset for an instrument that reads low", () => {
    expect(applyInstrumentOffset(1.006, 0.005)).toBeCloseTo(1.011, 6);
  });

  it("handles a negative offset (instrument reads high)", () => {
    expect(applyInstrumentOffset(1.041, -0.001)).toBeCloseTo(1.04, 6);
  });
});

describe("gravityPoints / predictedGravity", () => {
  it("computes Σ(lbs × PPG) / volume — batch 1's 6 lb LME in 5.5 gal", () => {
    expect(gravityPoints([{ lbs: 6, ppg: 36 }], 5.5)).toBeCloseTo(39.3, 1);
    expect(predictedGravity([{ lbs: 6, ppg: 36 }], 5.5)).toBeCloseTo(1.039, 3);
  });

  it("sums multiple fermentables", () => {
    const bill = [
      { lbs: 6, ppg: 36 },
      { lbs: 1, ppg: 44 },
    ];
    expect(gravityPoints(bill, 5)).toBeCloseTo((216 + 44) / 5, 5);
  });

  it("rejects a non-positive volume", () => {
    expect(() => gravityPoints([{ lbs: 6, ppg: 36 }], 0)).toThrow();
  });
});
