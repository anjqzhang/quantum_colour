export type GateFamily =
  | "I"
  | "X"
  | "Y"
  | "Z"
  | "H"
  | "RX"
  | "RY"
  | "RZ"
  | "CNOT"
  | "SWAP"
  | "CPHASE";

export type BasisState = "00" | "01" | "10" | "11";

export type Complex = {
  re: number;
  im: number;
};

export type Gate = {
  family: GateFamily;
  angle: number | null;
  qubits: number[];
  label: string;
};

export type Level = {
  id: string;
  title: string;
  description: string;
  hint: string;
  start: BasisState;
  startState: Complex[];
  startLabel: string;
  target: string | null;
  targetState: Complex[] | null;
  targetLabel: string | null;
  targetTolerance: number;
  maxGates: number;
  allowedGates: GateFamily[];
  aliases: string[];
  order: number;
};

export type Measurement = number | number[];

export type MeasurementCounts = Record<string, number>;
