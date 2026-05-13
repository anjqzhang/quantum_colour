import { gateAliases, maxQubits, rotationGates, supportedGates, twoQubitGates } from "./constants";
import { parseAngleExpression } from "./angle";
import type { Gate, GateFamily } from "./types";

export function parseGateInput(rawText: string): Gate[] {
  return tokenizeGateText(rawText).map(parseGateToken);
}

export function tokenizeGateText(rawText: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of rawText) {
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (depth === 0 && (/\s/.test(char) || char === "," || char === "/")) {
      const token = current.trim();
      if (token) {
        tokens.push(token);
      }
      current = "";
      continue;
    }
    current += char;
  }

  const token = current.trim();
  if (token) {
    tokens.push(token);
  }
  return tokens;
}

export function canonicalGateName(rawName: string): GateFamily {
  const normalized = rawName.trim().toUpperCase();
  const gate = gateAliases[normalized];
  if (!gate) {
    throw new Error(`Unsupported gate: ${rawName}. Supported gates: ${supportedGates.join(", ")}.`);
  }
  return gate;
}

function splitGateArguments(rawText: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of rawText) {
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      const arg = current.trim();
      if (arg) {
        args.push(arg);
      }
      current = "";
      continue;
    }
    current += char;
  }

  const arg = current.trim();
  if (arg) {
    args.push(arg);
  }
  return args;
}

export function parseQubitIndex(rawText: string): number {
  if (!/^[0-9]+$/.test(rawText.trim())) {
    throw new Error(`Invalid qubit index: ${rawText}`);
  }
  const qubit = Number(rawText);
  if (qubit < 0 || qubit >= maxQubits) {
    throw new Error(`Qubit index must be 0 or 1 for this two-qubit prototype: ${rawText}`);
  }
  return qubit;
}

function isQubitIndexText(rawText: string): boolean {
  return /^[0-9]+$/.test(rawText.trim());
}

function gateLabel(family: GateFamily, args: string[], qubits: number[]): string {
  if (twoQubitGates.has(family)) {
    return `${family}(${qubits[0]},${qubits[1]})`;
  }
  if (args.length === 0) {
    return family;
  }
  if (rotationGates.has(family)) {
    return `${family}(${args.join(", ")})`;
  }
  return `${family}(${qubits[0]})`;
}

export function parseGateToken(token: string): Gate {
  const trimmed = token.trim();
  const match = /^([A-Za-z]+)\((.*)\)$/.exec(trimmed);

  if (match) {
    const family = canonicalGateName(match[1]);
    const args = splitGateArguments(match[2]);

    if (rotationGates.has(family)) {
      let qubits: number[];
      let angleText: string;
      if (args.length === 1) {
        qubits = [0];
        angleText = args[0];
      } else if (args.length === 2) {
        if (!isQubitIndexText(args[0])) {
          throw new Error(`${family} two-argument form must be ${family}(qubit, angle).`);
        }
        qubits = [parseQubitIndex(args[0])];
        angleText = args[1];
      } else {
        throw new Error(`${family} needs an angle, optionally with one qubit index.`);
      }
      return {
        family,
        angle: parseAngleExpression(angleText),
        qubits,
        label: gateLabel(family, args, qubits),
      };
    }

    if (twoQubitGates.has(family)) {
      if (args.length !== 2) {
        throw new Error(`${family} needs two qubit indexes, for example ${family}(0,1).`);
      }
      const qubits = [parseQubitIndex(args[0]), parseQubitIndex(args[1])];
      if (qubits[0] === qubits[1]) {
        throw new Error(`${family} needs two different qubits.`);
      }
      return { family, angle: null, qubits, label: gateLabel(family, args, qubits) };
    }

    if (args.length !== 1) {
      throw new Error(`${family} needs one qubit index, for example ${family}(1).`);
    }
    const qubits = [parseQubitIndex(args[0])];
    return { family, angle: null, qubits, label: gateLabel(family, args, qubits) };
  }

  const family = canonicalGateName(trimmed);
  if (rotationGates.has(family)) {
    throw new Error(`${family} needs an angle, for example ${family}(pi/2).`);
  }
  const qubits = twoQubitGates.has(family) ? [0, 1] : [0];
  return { family, angle: null, qubits, label: gateLabel(family, [], qubits) };
}
