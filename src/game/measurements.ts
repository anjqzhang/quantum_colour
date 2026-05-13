import { cmykColors, stateNames } from "./constants";
import type { BasisState, Measurement, MeasurementCounts } from "./types";

export function normalizeMeasurements(rawMeasurements: unknown, qubitCount: number): Measurement[] {
  if (!Array.isArray(rawMeasurements)) {
    throw new Error(`Unexpected Quokka result type: ${typeof rawMeasurements}`);
  }
  return rawMeasurements.map((measurement) => normalizeMeasurementValue(measurement, qubitCount));
}

export function extractQuokkaMeasurements(payload: unknown, qubitCount: number): Measurement[] {
  if (!isRecord(payload)) {
    throw new Error("Unexpected Quokka response payload.");
  }

  const result = payload.result;
  if (isRecord(result) && "c" in result) {
    return normalizeMeasurements(result.c, qubitCount);
  }
  if ("c" in payload) {
    return normalizeMeasurements(payload.c, qubitCount);
  }
  const data = payload.data;
  if (isRecord(data) && "c" in data) {
    return normalizeMeasurements(data.c, qubitCount);
  }
  if ("measurements" in payload) {
    return normalizeMeasurements(payload.measurements, qubitCount);
  }

  throw new Error("Unexpected Quokka response payload.");
}

export function measurementLabel(measurement: Measurement | string): string {
  if (Array.isArray(measurement)) {
    return measurement.join("");
  }
  return String(measurement);
}

export function measurementCounts(measurements: Measurement[]): MeasurementCounts {
  return measurements.reduce<MeasurementCounts>((counts, measurement) => {
    const label = measurementLabel(measurement);
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});
}

export function measurementColor(measurement: Measurement | string): string {
  const label = measurementLabel(measurement);
  if (label in cmykColors) {
    return cmykColors[label as BasisState];
  }
  if (label === "0") {
    return "#000000";
  }
  if (label === "1") {
    return "#ffffff";
  }
  return "#555555";
}

export function measurementName(measurement: Measurement | string): string {
  const label = measurementLabel(measurement);
  return stateNames[label as keyof typeof stateNames] ?? label;
}

export function buildDotStrip(measurements: Measurement[], maxDots = 60): string {
  const sample =
    measurements.length <= maxDots
      ? measurements
      : Array.from({ length: maxDots }, (_, index) => measurements[Math.floor(index * (measurements.length / maxDots))]);
  const symbols: Record<string, string> = {
    "0": ".",
    "1": "o",
    "00": ".",
    "01": ":",
    "10": "o",
    "11": "@",
  };
  return sample.map((measurement) => symbols[measurementLabel(measurement)] ?? "?").join("");
}

function normalizeMeasurementValue(rawValue: unknown, qubitCount: number): Measurement {
  if (typeof rawValue === "number" && Number.isInteger(rawValue)) {
    return intToMeasurement(rawValue, qubitCount);
  }
  if (
    Array.isArray(rawValue) &&
    rawValue.length === qubitCount &&
    rawValue.every((bit) => Number.isInteger(bit) && (bit === 0 || bit === 1))
  ) {
    return qubitCount === 1 ? rawValue[0] : rawValue;
  }
  throw new Error(`Unexpected measurement value: ${JSON.stringify(rawValue)}`);
}

function intToMeasurement(value: number, qubitCount: number): Measurement {
  if (value < 0 || value >= 2 ** qubitCount) {
    throw new Error(`Unexpected measurement value: ${value}`);
  }
  if (qubitCount === 1) {
    return value;
  }
  return Array.from({ length: qubitCount }, (_, qubit) => (value >> (qubitCount - qubit - 1)) & 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
