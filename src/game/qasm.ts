import { rotationGates } from "./constants";
import { inferQubitCount, qubitBitMask, qubitCountForState } from "./simulator";
import type { Complex, Gate } from "./types";

export function buildQasm(gates: Gate[], startState: Complex[]): string {
  const qubitCount = inferQubitCount(gates, startState);
  const lines = ["OPENQASM 2.0;", `qreg q[${qubitCount}];`, `creg c[${qubitCount}];`];

  lines.push(...qasmPrepareBasisState(startState, qubitCount));

  for (const gate of gates) {
    const qasm = gateQasm(gate);
    if (qasm) {
      lines.push(qasm);
    }
  }

  for (let qubit = 0; qubit < qubitCount; qubit += 1) {
    lines.push(`measure q[${qubit}] -> c[${qubit}];`);
  }

  return `${lines.join("\n")}\n`;
}

export function gateQasm(gate: Gate): string {
  const [first, second] = gate.qubits;
  if (gate.family === "I") {
    return "";
  }
  if (gate.family === "RX") {
    const angle = formatQasmAngle(gate.angle ?? 0);
    return `h q[${first}];\nrz(${angle}) q[${first}];\nh q[${first}];`;
  }
  if (rotationGates.has(gate.family)) {
    return `${gate.family.toLowerCase()}(${formatQasmAngle(gate.angle ?? 0)}) q[${first}];`;
  }
  if (gate.family === "CNOT") {
    return `cx q[${first}],q[${second}];`;
  }
  if (gate.family === "SWAP") {
    return [`cx q[${first}],q[${second}];`, `cx q[${second}],q[${first}];`, `cx q[${first}],q[${second}];`].join("\n");
  }
  if (gate.family === "CPHASE") {
    return [`h q[${second}];`, `cx q[${first}],q[${second}];`, `h q[${second}];`].join("\n");
  }
  return `${gate.family.toLowerCase()} q[${first}];`;
}

export function formatQasmAngle(angle: number): string {
  return angle.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
}

function qasmPrepareBasisState(state: Complex[], qubitCount: number): string[] {
  const initialQubits = qubitCountForState(state);
  if (initialQubits !== qubitCount) {
    throw new Error("QASM preparation currently supports computational-basis starting colours only.");
  }
  const index = basisStateIndex(state);
  if (index === null) {
    throw new Error("QASM preparation currently supports computational-basis starting colours only.");
  }

  const lines: string[] = [];
  for (let qubit = 0; qubit < qubitCount; qubit += 1) {
    if (index & qubitBitMask(qubit, qubitCount)) {
      lines.push(`x q[${qubit}];`);
    }
  }
  return lines;
}

function basisStateIndex(state: Complex[]): number | null {
  const nonZeroIndexes = state
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => Math.hypot(value.re, value.im) > 1e-9);
  if (nonZeroIndexes.length !== 1) {
    return null;
  }
  const { value, index } = nonZeroIndexes[0];
  return Math.abs(Math.hypot(value.re, value.im) - 1) <= 1e-9 ? index : null;
}
