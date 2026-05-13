import { complex } from "./complex";
import type { BasisState, Complex, GateFamily } from "./types";

export const maxQubits = 2;

export const rotationGates = new Set<GateFamily>(["RX", "RY", "RZ"]);
export const twoQubitGates = new Set<GateFamily>(["CNOT", "SWAP", "CPHASE"]);

export const supportedGates: GateFamily[] = [
  "I",
  "X",
  "Y",
  "Z",
  "H",
  "RX",
  "RY",
  "RZ",
  "CNOT",
  "SWAP",
  "CPHASE",
];

export const gateAliases: Record<string, GateFamily> = {
  I: "I",
  X: "X",
  Z: "Z",
  Y: "Y",
  XZ: "Y",
  H: "H",
  HADAMARD: "H",
  RX: "RX",
  XROT: "RX",
  RY: "RY",
  YROT: "RY",
  RZ: "RZ",
  ZROT: "RZ",
  CNOT: "CNOT",
  CX: "CNOT",
  SWAP: "SWAP",
  CPHASE: "CPHASE",
  CZ: "CPHASE",
};

export const stateNames: Record<BasisState | "0" | "1", string> = {
  "0": "black",
  "1": "white",
  "00": "cyan",
  "01": "magenta",
  "10": "yellow",
  "11": "black",
};

export const targetAliases: Record<string, BasisState> = {
  "00": "00",
  "01": "01",
  "10": "10",
  "11": "11",
  "|00>": "00",
  "|01>": "01",
  "|10>": "10",
  "|11>": "11",
  cyan: "00",
  c: "00",
  magenta: "01",
  m: "01",
  yellow: "10",
  y: "10",
  black: "11",
  k: "11",
};

export const cmykColors: Record<BasisState, string> = {
  "00": "#00bcd4",
  "01": "#d81b60",
  "10": "#f5d90a",
  "11": "#111111",
};

export const basisStates: Record<BasisState, Complex[]> = {
  "00": [complex(1), complex(0), complex(0), complex(0)],
  "01": [complex(0), complex(1), complex(0), complex(0)],
  "10": [complex(0), complex(0), complex(1), complex(0)],
  "11": [complex(0), complex(0), complex(0), complex(1)],
};

export const gateDescriptions: Record<GateFamily, string> = {
  I: "Identity: a no-op in the game. It leaves the colour unchanged.",
  X: "Bit flip on one qubit.",
  Y: "Pauli Y: bit flip plus phase flip.",
  Z: "Pauli Z: phase flip.",
  H: "Hadamard: create an even superposition on one qubit.",
  RX: "Rotation around the X-axis.",
  RY: "Rotation around the Y-axis.",
  RZ: "Rotation around the Z-axis.",
  CNOT: "Controlled NOT: flip the target qubit when the control qubit is 1.",
  SWAP: "Swap the states of two qubits.",
  CPHASE: "Controlled phase: apply a phase flip when both qubits are 1.",
};
