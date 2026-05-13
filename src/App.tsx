import { useState } from "react";
import { levels } from "./levels";
import {
  applyGates,
  buildDotStrip,
  buildQasm,
  cmykColors,
  extractQuokkaMeasurements,
  gateDescriptions,
  measurementColor,
  measurementCounts,
  measurementName,
  parseGateInput,
  parseGateToken,
  stateMatchesTargetMix,
  validateGateSequence,
} from "./game";
import type { Gate, GateFamily, Level, Measurement } from "./game";

const defaultShots = 500;

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; measurements: Measurement[]; success: boolean | null; qasm: string }
  | { status: "error"; message: string; qasm?: string };

function App() {
  const [selectedLevelId, setSelectedLevelId] = useState(levels[0].id);
  const [gates, setGates] = useState<Gate[]>([]);
  const [rawGateText, setRawGateText] = useState("");
  const [gateFamily, setGateFamily] = useState<GateFamily>(levels[0].allowedGates[0] ?? "H");
  const [firstQubit, setFirstQubit] = useState("0");
  const [secondQubit, setSecondQubit] = useState("1");
  const [angleText, setAngleText] = useState("pi/2");
  const [shots, setShots] = useState(String(defaultShots));
  const [quokkaName, setQuokkaName] = useState("quokka1");
  const [message, setMessage] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>({ status: "idle" });

  const level = levels.find((item) => item.id === selectedLevelId) ?? levels[0];

  function selectLevel(id: string) {
    const nextLevel = levels.find((item) => item.id === id) ?? levels[0];
    setSelectedLevelId(id);
    setGateFamily(nextLevel.allowedGates[0] ?? "H");
    setGates([]);
    setRawGateText("");
    setMessage(null);
    setRunState({ status: "idle" });
  }

  function addGateFromBuilder() {
    setMessage(null);
    try {
      const token = buildGateToken(gateFamily, firstQubit, secondQubit, angleText);
      const gate = parseGateToken(token);
      const nextGates = [...gates, gate];
      validateGateSequence(nextGates, level.allowedGates, level.maxGates);
      setGates(nextGates);
      setRawGateText(nextGates.map((item) => item.label).join(" / "));
      setRunState({ status: "idle" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add that gate.");
    }
  }

  function applyRawGateText() {
    setMessage(null);
    try {
      const parsed = parseGateInput(rawGateText);
      validateGateSequence(parsed, level.allowedGates, level.maxGates);
      setGates(parsed);
      setRunState({ status: "idle" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not parse gate text.");
    }
  }

  function removeGate(index: number) {
    const nextGates = gates.filter((_, gateIndex) => gateIndex !== index);
    setGates(nextGates);
    setRawGateText(nextGates.map((item) => item.label).join(" / "));
    setRunState({ status: "idle" });
  }

  async function runCircuit() {
    setMessage(null);
    let qasm = "";
    try {
      validateGateSequence(gates, level.allowedGates, level.maxGates);
      const shotsValue = Number(shots);
      if (!Number.isInteger(shotsValue) || shotsValue <= 0) {
        throw new Error("Shots must be a positive integer.");
      }

      const finalState = applyGates(gates, level.startState);
      qasm = buildQasm(gates, level.startState);
      const qubitCount = Math.log2(level.startState.length);
      const success = level.targetState
        ? stateMatchesTargetMix(finalState, level.targetState, level.targetTolerance)
        : null;

      setRunState({ status: "running" });
      const response = await fetch("/api/quokka", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          script: qasm,
          count: shotsValue,
          quokkaName,
          qubitCount,
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const errorMessage =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Quokka request failed.";
        throw new Error(errorMessage);
      }
      const measurements = extractQuokkaMeasurements(payload, qubitCount);
      setRunState({ status: "success", measurements, success, qasm });
    } catch (error) {
      setRunState({
        status: "error",
        message: error instanceof Error ? error.message : "Run failed.",
        qasm: qasm || undefined,
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Quantum Colour Mixer</p>
          <h1>Mix CMYK colours with two qubits.</h1>
          <p className="hero-copy">
            Build a gate sequence, send the generated OpenQASM to Quokka, and watch measurement shots
            become colour.
          </p>
        </div>
        <div className="basis-card">
          {(["00", "01", "10", "11"] as const).map((key) => (
            <div className="basis-row" key={key}>
              <span className="swatch" style={{ background: cmykColors[key] }} />
              <span>|{key}&gt;</span>
              <strong>{measurementName(key)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="layout">
        <aside className="panel level-list">
          <h2>Modes</h2>
          {levels.map((item) => (
            <button
              className={item.id === level.id ? "level-button active" : "level-button"}
              key={item.id}
              type="button"
              onClick={() => selectLevel(item.id)}
            >
              <span>{item.title}</span>
              <small>{item.targetLabel ?? "No target"}</small>
            </button>
          ))}
        </aside>

        <section className="panel play-panel">
          <div className="level-heading">
            <div>
              <h2>{level.title}</h2>
              <p>{level.description}</p>
            </div>
            <div className="level-meta">
              <span>Start: {level.startLabel}</span>
              <span>Max gates: {level.maxGates}</span>
            </div>
          </div>

          {level.hint && <p className="hint">Hint: {level.hint}</p>}

          <div className="target-row">
            <div>
              <span className="label">Target:</span>
              <strong>{level.targetLabel ?? "Playground mode"}</strong>
            </div>
            <div>
              <span className="label">Allowed gates:</span>
              <strong>{level.allowedGates.join(", ")}</strong>
            </div>
          </div>

          <GateBuilder
            angleText={angleText}
            firstQubit={firstQubit}
            gateFamily={gateFamily}
            level={level}
            secondQubit={secondQubit}
            setAngleText={setAngleText}
            setFirstQubit={setFirstQubit}
            setGateFamily={setGateFamily}
            setSecondQubit={setSecondQubit}
            onAdd={addGateFromBuilder}
          />

          <div className="raw-editor">
            <label htmlFor="raw-gates">Raw gate input</label>
            <div className="raw-row">
              <input
                id="raw-gates"
                value={rawGateText}
                onChange={(event) => setRawGateText(event.target.value)}
                placeholder="H(0) / CNOT(0,1)"
              />
              <button type="button" onClick={applyRawGateText}>
                Apply text
              </button>
            </div>
          </div>

          {message && <p className="error-text">{message}</p>}

          <Circuit gates={gates} onRemove={removeGate} onReset={() => {
            setGates([]);
            setRawGateText("");
            setRunState({ status: "idle" });
          }} />

          <div className="run-row">
            <label>
              Shots
              <input value={shots} onChange={(event) => setShots(event.target.value)} inputMode="numeric" />
            </label>
            <label>
              Quokka
              <input value={quokkaName} onChange={(event) => setQuokkaName(event.target.value)} />
            </label>
            <button className="run-button" type="button" onClick={runCircuit} disabled={runState.status === "running"}>
              {runState.status === "running" ? "Running..." : "Run on Quokka"}
            </button>
          </div>

          <RunResult runState={runState} />
        </section>
      </section>
    </main>
  );
}

function GateBuilder(props: {
  angleText: string;
  firstQubit: string;
  gateFamily: GateFamily;
  level: Level;
  secondQubit: string;
  setAngleText: (value: string) => void;
  setFirstQubit: (value: string) => void;
  setGateFamily: (value: GateFamily) => void;
  setSecondQubit: (value: string) => void;
  onAdd: () => void;
}) {
  const isRotation = ["RX", "RY", "RZ"].includes(props.gateFamily);
  const isTwoQubit = ["CNOT", "SWAP", "CPHASE"].includes(props.gateFamily);

  return (
    <div className="builder">
      <div>
        <label htmlFor="gate-family">Gate</label>
        <select
          id="gate-family"
          value={props.gateFamily}
          onChange={(event) => props.setGateFamily(event.target.value as GateFamily)}
        >
          {props.level.allowedGates.map((gate) => (
            <option key={gate} value={gate}>
              {gate}
            </option>
          ))}
        </select>
        <small>{gateDescriptions[props.gateFamily]}</small>
      </div>
      <div>
        <label htmlFor="first-qubit">{isTwoQubit ? "First qubit" : "Qubit"}</label>
        <select id="first-qubit" value={props.firstQubit} onChange={(event) => props.setFirstQubit(event.target.value)}>
          <option value="0">0</option>
          <option value="1">1</option>
        </select>
      </div>
      {isTwoQubit && (
        <div>
          <label htmlFor="second-qubit">Second qubit</label>
          <select
            id="second-qubit"
            value={props.secondQubit}
            onChange={(event) => props.setSecondQubit(event.target.value)}
          >
            <option value="0">0</option>
            <option value="1">1</option>
          </select>
        </div>
      )}
      {isRotation && (
        <div>
          <label htmlFor="angle">Angle</label>
          <input
            id="angle"
            value={props.angleText}
            onChange={(event) => props.setAngleText(event.target.value)}
            placeholder="pi/3"
          />
        </div>
      )}
      <button type="button" onClick={props.onAdd}>
        Add gate
      </button>
    </div>
  );
}

function Circuit({ gates, onRemove, onReset }: { gates: Gate[]; onRemove: (index: number) => void; onReset: () => void }) {
  return (
    <div className="circuit">
      <div className="section-title">
        <h3>Circuit</h3>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
      {gates.length === 0 ? (
        <p className="empty">No gates yet. Add a magic to start mixing.</p>
      ) : (
        <div className="gate-strip">
          {gates.map((gate, index) => (
            <button key={`${gate.label}-${index}`} type="button" onClick={() => onRemove(index)}>
              {gate.label}
              <span>remove</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RunResult({ runState }: { runState: RunState }) {
  if (runState.status === "idle") {
    return <p className="muted">Run the circuit to request Quokka measurements.</p>;
  }
  if (runState.status === "running") {
    return <p className="muted">Waiting for Quokka measurements...</p>;
  }
  if (runState.status === "error") {
    return (
      <div className="result-card error">
        <h3>Round error</h3>
        <p>{runState.message}</p>
        {runState.qasm && <QasmBlock qasm={runState.qasm} />}
      </div>
    );
  }

  const counts = measurementCounts(runState.measurements);
  const total = runState.measurements.length || 1;
  return (
    <div className="result-card">
      <div className="section-title">
        <h3>Round result</h3>
        {runState.success === null ? (
          <strong>Playground mode</strong>
        ) : (
          <strong className={runState.success ? "yay" : "nay"}>{runState.success ? "YAY" : "NAY"}</strong>
        )}
      </div>
      <MeasurementPlot measurements={runState.measurements} />
      <p className="dot-strip">{buildDotStrip(runState.measurements)}</p>
      <div className="counts-grid">
        {Object.entries(counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, count]) => (
            <div key={label}>
              <span className="swatch" style={{ background: measurementColor(label) }} />
              <span>
                {measurementName(label)} |{label}&gt;
              </span>
              <strong>
                {count} ({((count / total) * 100).toFixed(1)}%)
              </strong>
            </div>
          ))}
      </div>
      <QasmBlock qasm={runState.qasm} />
    </div>
  );
}

function MeasurementPlot({ measurements }: { measurements: Measurement[] }) {
  const points = measurements.map((measurement, index) => {
    const x = 16 + seededUnit(index * 2 + 1) * 268;
    const y = 16 + seededUnit(index * 2 + 2) * 268;
    return { x, y, color: measurementColor(measurement) };
  });
  return (
    <svg className="measurement-plot" viewBox="0 0 300 300" role="img" aria-label="Measured colour mix">
      <rect x="1" y="1" width="298" height="298" rx="18" />
      {points.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="13" fill={point.color} />
      ))}
    </svg>
  );
}

function QasmBlock({ qasm }: { qasm: string }) {
  return (
    <details className="qasm-block">
      <summary>Generated OpenQASM</summary>
      <pre>{qasm}</pre>
    </details>
  );
}

function buildGateToken(family: GateFamily, firstQubit: string, secondQubit: string, angleText: string): string {
  if (["CNOT", "SWAP", "CPHASE"].includes(family)) {
    return `${family}(${firstQubit},${secondQubit})`;
  }
  if (["RX", "RY", "RZ"].includes(family)) {
    return `${family}(${firstQubit}, ${angleText})`;
  }
  return `${family}(${firstQubit})`;
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export default App;
