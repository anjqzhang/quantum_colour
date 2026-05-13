import type { Gate, GateFamily } from "./types";

export function validateGateSequence(gates: Gate[], allowedGates?: GateFamily[], maxGates?: number) {
  if (maxGates !== undefined && gates.length > maxGates) {
    throw new Error(`You can use at most ${maxGates} gates in this mode.`);
  }
  if (allowedGates) {
    const disallowed = gates.filter((gate) => !allowedGates.includes(gate.family));
    if (disallowed.length > 0) {
      throw new Error(`This mode only allows these gates: ${allowedGates.join(", ")}.`);
    }
  }
}
