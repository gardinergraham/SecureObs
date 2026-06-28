import type { News2Consciousness, News2Reading, Spo2Scale } from "../types/domain";

export type News2ScoreInput = Pick<
  News2Reading,
  "respirationRate" | "spo2" | "spo2Scale" | "onOxygen" | "systolicBp" | "pulse" | "consciousness" | "temperature"
>;

export function calculateNews2Score(reading: News2ScoreInput) {
  return (
    respirationScore(reading.respirationRate) +
    spo2Score(reading.spo2, reading.spo2Scale, reading.onOxygen) +
    (reading.onOxygen ? 2 : 0) +
    bpScore(reading.systolicBp) +
    pulseScore(reading.pulse) +
    consciousnessScore(reading.consciousness) +
    temperatureScore(reading.temperature)
  );
}

export function respirationScore(value: number) {
  if (value <= 8 || value >= 25) return 3;
  if (value >= 21) return 2;
  if (value >= 9 && value <= 11) return 1;
  return 0;
}

export function spo2Score(value: number, scale: Spo2Scale, onOxygen: boolean) {
  if (scale === "Scale 1") {
    if (value <= 91) return 3;
    if (value <= 93) return 2;
    if (value <= 95) return 1;
    return 0;
  }

  if (value <= 83 || (onOxygen && value >= 97)) return 3;
  if (value <= 85 || (onOxygen && value >= 95)) return 2;
  if (value <= 87 || (onOxygen && value >= 93)) return 1;
  return 0;
}

export function bpScore(value: number) {
  if (value <= 90 || value >= 220) return 3;
  if (value <= 100) return 2;
  if (value <= 110) return 1;
  return 0;
}

export function pulseScore(value: number) {
  if (value <= 40 || value >= 131) return 3;
  if (value >= 111) return 2;
  if ((value >= 41 && value <= 50) || (value >= 91 && value <= 110)) return 1;
  return 0;
}

export function consciousnessScore(value: News2Consciousness) {
  return value === "Alert" ? 0 : 3;
}

export function temperatureScore(value: number) {
  if (value <= 35) return 3;
  if (value >= 39.1) return 2;
  if (value >= 38.1) return 1;
  if (value >= 36.1) return 0;
  return 1;
}
