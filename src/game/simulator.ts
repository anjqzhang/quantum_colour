import { add, complex, mul } from "./complex";
import { maxQubits } from "./constants";
import type { Complex, Gate } from "./types";
import { cloneState } from "./colour";

type Matrix2 = [[Complex, Complex], [Complex, Complex]];

export function applyGates(gates: Gate[], startState: Complex[]): Complex[] {
  const qubitCount = inferQubitCount(gates, startState);
  let state = expandState(startState, qubitCount);

  for (const gate of gates) {
    const [first, second] = gate.qubits;
    if (gate.family === "CNOT") {
      state = applyCnotGate(state, first, second, qubitCount);
    } else if (gate.family === "SWAP") {
      state = applySwapGate(state, first, second, qubitCount);
    } else if (gate.family === "CPHASE") {
      state = applyCphaseGate(state, first, second, qubitCount);
    } else {
      state = applySingleQubitGate(state, gateMatrix(gate), first, qubitCount);
    }
  }

  return state;
}

export function inferQubitCount(gates: Gate[], startState: Complex[]): number {
  let qubitCount = qubitCountForState(startState);
  for (const gate of gates) {
    qubitCount = Math.max(qubitCount, Math.max(...gate.qubits) + 1);
  }
  return qubitCount;
}

export function qubitCountForState(state: Complex[]): number {
  const qubitCount = Math.log2(state.length);
  if (!Number.isInteger(qubitCount)) {
    throw new Error(`State vector length must be a power of 2, got ${state.length}.`);
  }
  if (qubitCount > maxQubits) {
    throw new Error(`This prototype supports at most ${maxQubits} qubits.`);
  }
  return qubitCount;
}

export function expandState(state: Complex[], qubitCount: number): Complex[] {
  let expanded = cloneState(state);
  let currentQubits = qubitCountForState(expanded);
  if (currentQubits > qubitCount) {
    throw new Error("Cannot shrink the starting state to fewer qubits.");
  }
  while (currentQubits < qubitCount) {
    expanded = expanded.flatMap((amplitude) => [amplitude, complex(0)]);
    currentQubits += 1;
  }
  return expanded;
}

export function qubitBitMask(qubit: number, qubitCount: number): number {
  return 1 << (qubitCount - qubit - 1);
}

function applySingleQubitGate(state: Complex[], matrix: Matrix2, target: number, qubitCount: number): Complex[] {
  const output = state.map(() => complex(0));
  const targetMask = qubitBitMask(target, qubitCount);

  for (let index = 0; index < state.length; index += 1) {
    const bit = index & targetMask ? 1 : 0;
    const zeroIndex = index & ~targetMask;
    const oneIndex = zeroIndex | targetMask;
    output[index] = add(mul(matrix[bit][0], state[zeroIndex]), mul(matrix[bit][1], state[oneIndex]));
  }

  return output;
}

function applyCnotGate(state: Complex[], control: number, target: number, qubitCount: number): Complex[] {
  const output = state.map(() => complex(0));
  const controlMask = qubitBitMask(control, qubitCount);
  const targetMask = qubitBitMask(target, qubitCount);
  for (let index = 0; index < state.length; index += 1) {
    const targetIndex = index & controlMask ? index ^ targetMask : index;
    output[targetIndex] = add(output[targetIndex], state[index]);
  }
  return output;
}

function applySwapGate(state: Complex[], first: number, second: number, qubitCount: number): Complex[] {
  const output = state.map(() => complex(0));
  const firstMask = qubitBitMask(first, qubitCount);
  const secondMask = qubitBitMask(second, qubitCount);
  for (let index = 0; index < state.length; index += 1) {
    const firstBit = Boolean(index & firstMask);
    const secondBit = Boolean(index & secondMask);
    const targetIndex = firstBit !== secondBit ? index ^ firstMask ^ secondMask : index;
    output[targetIndex] = add(output[targetIndex], state[index]);
  }
  return output;
}

function applyCphaseGate(state: Complex[], control: number, target: number, qubitCount: number): Complex[] {
  const output = cloneState(state);
  const controlMask = qubitBitMask(control, qubitCount);
  const targetMask = qubitBitMask(target, qubitCount);
  for (let index = 0; index < output.length; index += 1) {
    if (index & controlMask && index & targetMask) {
      output[index] = complex(-output[index].re, -output[index].im);
    }
  }
  return output;
}

function gateMatrix(gate: Gate): Matrix2 {
  if (gate.family === "I") {
    return [[complex(1), complex(0)], [complex(0), complex(1)]];
  }
  if (gate.family === "X") {
    return [[complex(0), complex(1)], [complex(1), complex(0)]];
  }
  if (gate.family === "Y") {
    return [[complex(0), complex(0, -1)], [complex(0, 1), complex(0)]];
  }
  if (gate.family === "Z") {
    return [[complex(1), complex(0)], [complex(0), complex(-1)]];
  }
  if (gate.family === "H") {
    const s = 1 / Math.sqrt(2);
    return [[complex(s), complex(s)], [complex(s), complex(-s)]];
  }

  const theta = gate.angle ?? 0;
  const half = theta / 2;
  if (gate.family === "RX") {
    return [
      [complex(Math.cos(half)), complex(0, -Math.sin(half))],
      [complex(0, -Math.sin(half)), complex(Math.cos(half))],
    ];
  }
  if (gate.family === "RY") {
    return [
      [complex(Math.cos(half)), complex(-Math.sin(half))],
      [complex(Math.sin(half)), complex(Math.cos(half))],
    ];
  }
  if (gate.family === "RZ") {
    return [
      [complex(Math.cos(-half), Math.sin(-half)), complex(0)],
      [complex(0), complex(Math.cos(half), Math.sin(half))],
    ];
  }

  throw new Error(`Unsupported gate family: ${gate.family}`);
}
