import { basisStates, stateNames, targetAliases } from "./constants";
import { complex, magnitudeSquared } from "./complex";
import type { BasisState, Complex } from "./types";

export function parseColourBasisState(rawText: string): { state: Complex[]; label: string; key: BasisState } {
  const normalized = rawText.trim().toLowerCase();
  const key = targetAliases[normalized];
  if (!key) {
    throw new Error("Please choose cyan, magenta, yellow, black, or a basis state: 00, 01, 10, or 11.");
  }
  return { state: cloneState(basisStates[key]), label: stateNames[key], key };
}

export function parseColourState(rawText: string): { state: Complex[]; label: string } {
  try {
    const basis = parseColourBasisState(rawText);
    return { state: basis.state, label: basis.label };
  } catch {
    const mix = parseCmykMix(rawText);
    if (mix) {
      return mix;
    }
    throw new Error("Please choose CMYK colours, basis states like 01, or a mix like '50 cyan / 50 magenta'.");
  }
}

export function cloneState(state: Complex[]): Complex[] {
  return state.map((value) => complex(value.re, value.im));
}

export function measurementProbabilities(state: Complex[]): number[] {
  return state.map(magnitudeSquared);
}

export function stateMatchesTargetMix(actual: Complex[], desired: Complex[], tolerance = 1e-9): boolean {
  if (actual.length !== desired.length) {
    return false;
  }
  const actualProbabilities = measurementProbabilities(actual);
  const desiredProbabilities = measurementProbabilities(desired);
  return actualProbabilities.every(
    (value, index) => Math.abs(value - desiredProbabilities[index]) <= tolerance,
  );
}

function parseCmykMix(rawText: string): { state: Complex[]; label: string } | null {
  const components = rawText
    .trim()
    .split(/\s*(?:\/|,|\band\b)\s*/i)
    .map((component) => component.trim())
    .filter(Boolean);

  if (components.length < 2) {
    return null;
  }

  const weights: Record<BasisState, number> = {
    "00": 0,
    "01": 0,
    "10": 0,
    "11": 0,
  };

  for (const component of components) {
    const parsed = parseCmykMixComponent(component);
    if (!parsed) {
      return null;
    }
    weights[parsed.key] += parsed.weight;
  }

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    throw new Error("The CMYK colour weights must add up to more than zero.");
  }

  const probabilities = {
    "00": weights["00"] / total,
    "01": weights["01"] / total,
    "10": weights["10"] / total,
    "11": weights["11"] / total,
  };
  const orderedKeys: BasisState[] = ["00", "01", "10", "11"];
  const state = orderedKeys.map((key) => complex(Math.sqrt(probabilities[key])));
  const label = orderedKeys
    .filter((key) => probabilities[key] > 0)
    .map((key) => `${formatProbability(probabilities[key])} ${stateNames[key]}`)
    .join(" / ");
  return { state, label };
}

function parseCmykMixComponent(rawComponent: string): { key: BasisState; weight: number } | null {
  const component = rawComponent.trim().toLowerCase();
  const number = "([0-9]*\\.?[0-9]+)";
  const colour = "([a-z][a-z\\s-]*|\\|?[01]{2}>?)";

  const leading = new RegExp(`^${number}\\s*%?\\s*${colour}$`).exec(component);
  if (leading) {
    const key = cmykComponentState(leading[2]);
    return key ? { key, weight: Number(leading[1]) } : null;
  }

  const trailing = new RegExp(`^${colour}\\s*${number}\\s*%?$`).exec(component);
  if (trailing) {
    const key = cmykComponentState(trailing[1]);
    return key ? { key, weight: Number(trailing[2]) } : null;
  }

  const key = cmykComponentState(component);
  return key ? { key, weight: 1 } : null;
}

function cmykComponentState(rawName: string): BasisState | null {
  const normalized = rawName.trim().toLowerCase().replace(/^\|/, "").replace(/>$/, "");
  return targetAliases[normalized] ?? null;
}

function formatProbability(value: number): string {
  const percent = value * 100;
  return Math.abs(percent - Math.round(percent)) < 1e-9
    ? String(Math.round(percent))
    : percent.toFixed(1);
}
