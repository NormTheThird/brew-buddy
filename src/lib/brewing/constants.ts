import type { Batch } from "@/lib/db/schema";
import { isEstimated } from "./display";

/* Learned per-vessel constants (brief §4): rolling averages over MEASURED
   values only — estimates never feed a constant. */

export type LearnedConstant = { value: number; batches: number } | null;

export type VesselConstants = {
  boilOffGalPerHr: LearnedConstant;
  kettleLossGal: LearnedConstant;
  chillMinutes: LearnedConstant;
};

function avg(values: number[]): LearnedConstant {
  if (values.length === 0) return null;
  return {
    value: values.reduce((a, b) => a + b, 0) / values.length,
    batches: values.length,
  };
}

export function learnedConstants(batchesForVessel: Batch[]): VesselConstants {
  const boilOff: number[] = [];
  const kettleLoss: number[] = [];
  const chill: number[] = [];

  for (const b of batchesForVessel) {
    const preOk = b.preBoilVolumeGal != null && !isEstimated(b, "preBoilVolumeGal");
    const postOk = b.postBoilVolumeGal != null && !isEstimated(b, "postBoilVolumeGal");
    const fermOk = b.intoFermenterGal != null && !isEstimated(b, "intoFermenterGal");
    if (preOk && postOk && b.boilMinutes) {
      boilOff.push((b.preBoilVolumeGal! - b.postBoilVolumeGal!) / (b.boilMinutes / 60));
    }
    if (postOk && fermOk) {
      kettleLoss.push(b.postBoilVolumeGal! - b.intoFermenterGal!);
    }
    if (b.timeToChillMinutes != null) {
      chill.push(b.timeToChillMinutes);
    }
  }

  return {
    boilOffGalPerHr: avg(boilOff),
    kettleLossGal: avg(kettleLoss),
    chillMinutes: avg(chill),
  };
}
