# Project Findings

Date reviewed: 2026-05-13

This file records a working understanding of the project for future Codex sessions.

## Purpose

`quantum_colour` is a browser-based game called "Colour Mixer, a quantum game". It teaches basic quantum operations by mapping two-qubit computational basis states to CMYK-style colours:

- `|00>`: cyan
- `|01>`: magenta
- `|10>`: yellow
- `|11>`: black

Players start from a basis colour, apply a constrained set of quantum "magics" or gates, and try to produce a target colour distribution. Success is checked against measurement probabilities, not exact quantum phase.

## Repository Shape

- `src/game/*`: browser and testable TypeScript game engine, including parsing, state-vector simulation, QASM generation, measurement normalization, and target matching.
- `src/App.tsx`: main React game UI.
- `functions/api/quokka.ts`: Cloudflare Pages Function proxy for Quokka.
- `README.md`: user-facing overview, examples, gate syntax, and level authoring notes.
- `levels/*.json`: level definitions, one JSON file per level.
- `.gitignore`: ignores `.mplcache/`, `__pycache__/`, and generated output.

The former Python CLI file, `quantum_game.py`, was removed after the webapp implementation. Preserve the notes below if a Node CLI is rebuilt.

## Runtime Dependencies

The webapp uses:

- React + Vite + TypeScript
- Cloudflare Pages Functions through Wrangler
- Quokka over HTTPS via same-origin `/api/quokka`

The browser app sends generated OpenQASM to `/api/quokka`; the Cloudflare Function forwards it to `https://{quokka}.quokkacomputing.com/qsim/qasm`. Network access and a reachable Quokka endpoint are required for measurements. Local state-vector simulation and QASM generation happen before the Quokka call.

## Main Concepts

Supported gates are defined in the TypeScript game engine:

- Fixed single-qubit gates: `I`, `X`, `Y`, `Z`, `H`
- Rotation gates: `RX`, `RY`, `RZ`
- Two-qubit gates: `CNOT`, `SWAP`, `CPHASE`

Gate aliases include names such as `HADAMARD`, `CX`, `CZ`, `XROT`, `YROT`, and `ZROT`. The prototype is capped at two qubits via `MAX_QUBITS = 2`.

Gate input is tokenized from whitespace, commas, or `/` separators outside parentheses. Examples:

- `H(1)`
- `RY(1, pi/3)`
- `H(0) / CNOT(0,1)`

Rotation angles are parsed from a restricted expression grammar containing numbers, `pi`, arithmetic operators, parentheses, and whitespace.

## Level Format

Levels are text files with `key: value` lines. Required fields are:

- `id`
- `title`
- `description`
- `max_gates`
- `allowed_gates`
- `order`
- `aliases`
- `target`

Optional or commonly used fields include:

- `start`, defaulting to `black`
- `hint`
- `target_tolerance`, defaulting to `1e-9`

`target: none` creates a playground-style mode without success checking. Otherwise targets can be basis colours/states or weighted mixes such as `75 cyan / 25 magenta`.

Current bundled levels:

- Level 1: create a 50/50 cyan-magenta mix with one `H`.
- Level 2: create an equal four-colour mix with two `H` gates.
- Level 3: create a cyan-black blend using entanglement with `H` and `CNOT`.
- Level 4: create an approximate 75/25 cyan-magenta blend using `RY`.
- Level 5: create a 75/25 cyan-yellow blend using `RY` and `SWAP`.
- Playground: no target, max 10 gates, all supported gates allowed.

## Webapp Execution Flow

The normal run path is:

1. React loads bundled level definitions from JSON files in `levels/` via `src/levels.ts`.
2. The user selects a level or playground.
3. The user adds gates through the builder or raw gate text.
4. The TypeScript engine parses gates, validates level constraints, simulates the final state locally, and builds OpenQASM.
5. The browser posts QASM to `/api/quokka`.
6. The Cloudflare Pages Function forwards to Quokka and returns normalized measurements.
7. The UI renders an SVG measurement plot, counts, dot strip, QASM, and YAY/NAY based on local simulated probabilities.

## Former Python CLI Behavior For Node Reimplementation

The removed `quantum_game.py` was a single-file Python CLI with these user-facing modes:

- `python quantum_game.py`: started an interactive mode menu using levels from `levels/*.txt`.
- `python quantum_game.py --level levels/lv1.txt`: loaded a specific legacy text level file and started the same interactive level loop.
- `python quantum_game.py --start cyan --target "50 cyan / 50 magenta" --gates "H(1)" --shots 500`: runs one custom, non-interactive round.

Important CLI options:

- `--level`: path to a level file. Mutually exclusive with `--target`, `--start`, and `--gates` because it launches the interactive level flow.
- `--start`: basis-only starting colour for custom mode. Accepted `cyan`, `magenta`, `yellow`, `black`, `00`, `01`, `10`, `11`. Default was `black`.
- `--target`: desired basis state or weighted CMYK mix for custom mode. Examples: `magenta`, `01`, `50 cyan / 50 magenta`.
- `--gates`: raw gate list, separated by spaces, commas, or `/`; default empty.
- `--shots`: positive integer measurement count; default `500`.
- `--quokka`: Quokka hostname prefix; default `quokka1`.
- `--output`: QASM output path; default `generated/player_circuit.qasm`.

Interactive behavior to preserve in a Node CLI:

- Print title, description, hint, starting colour, maximum gates, and allowed gate help for the selected level.
- Prompt for gate text until it parses and satisfies `allowed_gates` and `max_gates`.
- Run a round and then prompt for next action: replay level, return to menu, or quit.
- Playground is represented as a level with `target: none`; it has no success check.

Round behavior to preserve:

- Parse gate text into canonical gate records.
- Validate gate count and allowed gate families.
- Simulate final state locally.
- Build OpenQASM 2.0.
- Write QASM to the configured output file.
- Request Quokka measurements.
- On success, write a measurement plot beside the QASM file as `{qasm_stem}_measurements.png`, print a colour strip, and print YAY/NAY unless in playground mode.
- On Quokka failure, print the selected mode, starting colour, target, gate sequence, QASM path, and the Quokka error.

Former Python-only implementation details:

- Used `numpy` arrays for complex state vectors and matrix operations.
- Used `requests.post` to call `http://{quokka}.quokkacomputing.com/qsim/qasm` with `{ script, count }`; the webapp now uses HTTPS through the Cloudflare proxy.
- Used Matplotlib with `Agg` backend to draw semi-transparent measurement circles.
- Set `MPLCONFIGDIR` to `.mplcache` under the repo.
- Success was always based on local probabilities, not sampled measurement counts.
- Quokka response shapes accepted were `{"result": {"c": ...}}`, `{"c": ...}`, and `{"data": {"c": ...}}`.

The current TypeScript game engine already contains most logic needed for a Node CLI. A Node CLI should reuse `src/game/*` for parsing, simulation, QASM, target matching, validation, and measurement normalization, then add terminal prompts, filesystem QASM output, and optionally a Node-side SVG/PNG plotter.

## Simulation And QASM

The local simulator applies gates directly to a NumPy state vector:

- Single-qubit gates use tensor reshaping, `np.moveaxis`, and `np.tensordot`.
- `CNOT`, `SWAP`, and `CPHASE` are implemented manually by bit masks.
- Measurement probabilities are `abs(state) ** 2`.

QASM generation:

- Writes OpenQASM 2.0 with `qreg` and `creg`.
- Prepares computational-basis starting states with `x` gates.
- Converts `SWAP` to three `cx` gates.
- Converts `CPHASE`/`CZ` to `h`, `cx`, `h`.
- Converts `RX` to `h`, `rz`, `h`, likely because the target backend supports that decomposition.
- Appends measurement statements for all qubits.

One implementation constraint: QASM preparation only supports computational-basis starting colours for multi-qubit states. That was fine for the former CLI and remains fine for the current level model because starts are restricted to basis states.

## Output And Success

Quokka responses are normalized from one of several accepted payload shapes:

- `{"result": {"c": ...}}`
- `{"c": ...}`
- `{"data": {"c": ...}}`

Measurements are rendered in two ways:

- A text strip using symbols for colours.
- A Matplotlib scatter plot where semi-transparent dots visually approximate a mixed colour.

Success uses local simulated probabilities compared with target probabilities via `np.allclose(..., atol=target_tolerance)`. Quokka measurements are used for visual/report output, not for determining whether the target was mathematically reached.

## Verification Notes

Commands run during the original Python review:

- `python3 -m py_compile quantum_game.py`: passed before removal.
- `python3 quantum_game.py --help`: failed in the then-current environment with `ModuleNotFoundError: No module named 'numpy'`.

The failure indicated missing local Python dependencies, not necessarily a code defect. The Python implementation has since been removed.

## Maintenance Risks And Opportunities

- Add more tests for parsing, gate application, QASM generation, level loading, and target matching. These can run offline without Quokka.
- Consider an offline measurement mode using `np.random.choice` from local probabilities. This would make demos/tests work without Quokka.
- Review the `Y` gate description: the README says `Y` is a phase flip and `Z` is state and phase flip, but the code implements standard Pauli matrices where `X` flips, `Z` phase-flips, and `Y` is bit flip plus phase.
- Level 5 aliases include `swap` twice; harmless but worth cleaning.
