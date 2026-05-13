# Project Findings

Date reviewed: 2026-05-13

This file records a working understanding of the project for future Codex sessions.

## Purpose

`quantum_colour` is a small Python CLI game called "Colour Mixer, a quantum game". It teaches basic quantum operations by mapping two-qubit computational basis states to CMYK-style colours:

- `|00>`: cyan
- `|01>`: magenta
- `|10>`: yellow
- `|11>`: black

Players start from a basis colour, apply a constrained set of quantum "magics" or gates, and try to produce a target colour distribution. Success is checked against measurement probabilities, not exact quantum phase.

## Repository Shape

- `quantum_game.py`: all application logic, CLI, state-vector simulation, QASM generation, Quokka integration, result reporting, and plotting.
- `README.md`: user-facing overview, examples, gate syntax, and level authoring notes.
- `levels/*.txt`: level definitions in a simple key-value text format.
- `.gitignore`: ignores `.mplcache/`, `__pycache__/`, and generated output.

There is currently no dependency manifest such as `requirements.txt`, `pyproject.toml`, or lockfile.

## Runtime Dependencies

The code imports:

- `numpy`
- `requests`
- `matplotlib`

The game sends generated OpenQASM to Quokka over HTTP via `requests.post("http://{quokka}.quokkacomputing.com/qsim/qasm", ...)`. Network access and a reachable Quokka endpoint are required for measurements. Local state-vector simulation and QASM generation happen before the Quokka call.

## Main Concepts

Supported gates are defined in `quantum_game.py`:

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

## Execution Flow

The normal run path is:

1. CLI arguments are parsed in `build_parser()` and `main()`.
2. With no `--target`, the interactive level menu is launched.
3. With `--level`, an external level file is parsed and played interactively.
4. With `--target`, a single custom run is executed from CLI arguments.
5. `run_round()` parses gate text, validates allowed/max gates, simulates the state locally, builds QASM, writes the QASM file, asks Quokka for measurements, plots results, and prints a round report.

Default generated output path is `generated/player_circuit.qasm`; the measurement plot is written beside it as `player_circuit_measurements.png`.

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

One implementation constraint: QASM preparation only supports computational-basis starting colours for multi-qubit states. That is fine for the current CLI and level model because `--start` and level `start` are restricted to basis states.

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

Commands run during review:

- `python3 -m py_compile quantum_game.py`: passed.
- `python3 quantum_game.py --help`: failed in the current environment with `ModuleNotFoundError: No module named 'numpy'`.

The failure indicates missing local Python dependencies, not necessarily a code defect. Add a dependency manifest or install `numpy`, `requests`, and `matplotlib` before running the game or adding automated tests.

## Maintenance Risks And Opportunities

- Add `requirements.txt` or `pyproject.toml` so setup is reproducible.
- Add tests for parsing, gate application, QASM generation, level loading, and target matching. These can run offline without Quokka.
- Consider separating the single-file app into modules only if the project grows; current size is manageable for a prototype but hard to test cleanly.
- Consider an offline measurement mode using `np.random.choice` from local probabilities. This would make demos/tests work without Quokka.
- Review the `Y` gate description: the README says `Y` is a phase flip and `Z` is state and phase flip, but the code implements standard Pauli matrices where `X` flips, `Z` phase-flips, and `Y` is bit flip plus phase.
- `print_level_intro()` appears unused; remove it or wire it in if a separate intro step is desired.
- Level 5 aliases include `swap` twice; harmless but worth cleaning.
