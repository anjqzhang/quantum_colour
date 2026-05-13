import { describe, expect, it } from "vitest";
import { buildQasm } from "./qasm";
import { parseColourBasisState, parseColourState, stateMatchesTargetMix } from "./colour";
import { parseGateInput } from "./parser";
import { applyGates } from "./simulator";
import { validateGateSequence } from "./validation";

function expectCircuitMatches(start: string, gatesText: string, target: string, tolerance = 1e-9) {
  const startState = parseColourBasisState(start).state;
  const gates = parseGateInput(gatesText);
  const actual = applyGates(gates, startState);
  const desired = parseColourState(target).state;
  expect(stateMatchesTargetMix(actual, desired, tolerance)).toBe(true);
}

describe("quantum colour game engine", () => {
  it("matches the existing level examples", () => {
    expectCircuitMatches("cyan", "H(1)", "50 cyan / 50 magenta");
    expectCircuitMatches("cyan", "H(0) / CNOT(0,1)", "50 cyan / 50 black");
    expectCircuitMatches("cyan", "RY(1, pi/3)", "75 cyan / 25 magenta", 0.05);
    expectCircuitMatches("cyan", "RY(1, pi/3) / SWAP(0,1)", "75 cyan / 25 yellow", 0.05);
  });

  it("rejects invalid gates and level constraint violations", () => {
    expect(() => parseGateInput("NOPE(0)")).toThrow(/Unsupported gate/);
    expect(() => parseGateInput("H(2)")).toThrow(/Qubit index/);
    expect(() => parseGateInput("RY(0, tau)")).toThrow(/Unsupported rotation angle/);
    expect(() => validateGateSequence(parseGateInput("H(0) H(1)"), ["H"], 1)).toThrow(/at most 1/);
    expect(() => validateGateSequence(parseGateInput("X(0)"), ["H"], 1)).toThrow(/only allows/);
  });

  it("generates OpenQASM for composite gates", () => {
    const qasm = buildQasm(parseGateInput("RX(0, pi/2) / SWAP(0,1) / CPHASE(0,1)"), parseColourBasisState("cyan").state);
    expect(qasm).toContain("OPENQASM 2.0;");
    expect(qasm).toContain("rz(1.570796326795) q[0];");
    expect(qasm).toContain("cx q[0],q[1];");
    expect(qasm).toContain("cx q[1],q[0];");
    expect(qasm).toContain("measure q[0] -> c[0];");
    expect(qasm).toContain("measure q[1] -> c[1];");
  });
});
