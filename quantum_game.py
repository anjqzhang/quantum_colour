#!/usr/bin/env python3

import argparse
import os
import re
from pathlib import Path
from typing import Iterable, List

import numpy as np
import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

SCRIPT_DIR = Path(__file__).resolve().parent
os.environ.setdefault("MPLCONFIGDIR", str(SCRIPT_DIR / ".mplcache"))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

FIXED_GATES = {
    "I": np.array([[1, 0], [0, 1]], dtype=complex),
    "X": np.array([[0, 1], [1, 0]], dtype=complex),
    "Y": np.array([[0, -1j], [1j, 0]], dtype=complex),
    "Z": np.array([[1, 0], [0, -1]], dtype=complex),
    "H": (1 / np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex),
}
ROTATION_GATES = {"RX", "RY", "RZ"}
TWO_QUBIT_GATES = {"CNOT", "SWAP", "CPHASE"}
SUPPORTED_GATES = set(FIXED_GATES) | ROTATION_GATES | TWO_QUBIT_GATES
MAX_QUBITS = 2
GATE_ALIASES = {
    "I": "I",
    "X": "X",
    "Z": "Z",
    "Y": "Y",
    "XZ": "Y",
    "H": "H",
    "HADAMARD": "H",
    "RX": "RX",
    "XROT": "RX",
    "RY": "RY",
    "YROT": "RY",
    "RZ": "RZ",
    "ZROT": "RZ",
    "CNOT": "CNOT",
    "CX": "CNOT",
    "SWAP": "SWAP",
    "CPHASE": "CPHASE",
    "CZ": "CPHASE",
}

INITIAL_STATE = np.array([1, 0, 0, 0], dtype=complex)
TARGET_STATES = {
    "00": np.array([1, 0, 0, 0], dtype=complex),
    "01": np.array([0, 1, 0, 0], dtype=complex),
    "10": np.array([0, 0, 1, 0], dtype=complex),
    "11": np.array([0, 0, 0, 1], dtype=complex),
}
STATE_NAMES = {
    "0": "black",
    "1": "white",
    "00": "cyan",
    "01": "magenta",
    "10": "yellow",
    "11": "black",
}
TARGET_ALIASES = {
    "00": "00",
    "01": "01",
    "10": "10",
    "11": "11",
    "|00>": "00",
    "|01>": "01",
    "|10>": "10",
    "|11>": "11",
    "cyan": "00",
    "c": "00",
    "magenta": "01",
    "m": "01",
    "yellow": "10",
    "y": "10",
    "black": "11",
    "cmyk black": "11",
    "cmyk-black": "11",
    "key": "11",
    "k": "11",
}
CMYK_COLOUR_ALIASES = {
    "cyan": "00",
    "c": "00",
    "magenta": "01",
    "m": "01",
    "yellow": "10",
    "y": "10",
    "black": "11",
    "key": "11",
    "k": "11",
    "cmyk black": "11",
    "cmyk-black": "11",
}
BIT_COLORS = {
    0: "#000000",
    1: "#ffffff",
}
CMYK_COLORS = {
    "00": "#00bcd4",
    "01": "#d81b60",
    "10": "#f5d90a",
    "11": "#111111",
}
DEFAULT_OUTPUT_PATH = SCRIPT_DIR / "generated" / "player_circuit.qasm"
LEVELS_DIR = SCRIPT_DIR / "levels"
GATE_DESCRIPTIONS = {
    "I": "Identity: a no-op in the game. It leaves the colour unchanged.",
    "X": "Bit flip on one qubit. Example: X(1)",
    "Y": "Pauli Y: bit flip plus phase flip.",
    "Z": "Pauli Z: phase flip.",
    "H": "Hadamard: create an even superposition on one qubit. Example: H(1)",
    "RX": "Rotation around the X-axis. Example: RX(pi/2)",
    "RY": "Rotation around the Y-axis. Example: RY(pi/2)",
    "RZ": "Rotation around the Z-axis. Example: RZ(pi/2)",
    "CNOT": "Controlled NOT: flip the target qubit when the control qubit is 1. Example: CNOT(0,1)",
    "SWAP": "Swap the states of two qubits. Example: SWAP(0,1)",
    "CPHASE": "Controlled phase: apply a phase flip when both qubits are 1. Example: CPHASE(0,1)",
}


def parse_gate_input(raw_text: str):
    tokens = tokenize_gate_text(raw_text)
    return [parse_gate_token(token) for token in tokens]


def tokenize_gate_text(raw_text: str) -> List[str]:
    tokens = []
    current = []
    depth = 0

    for char in raw_text:
        if char == "(":
            depth += 1
            current.append(char)
            continue
        if char == ")":
            depth = max(0, depth - 1)
            current.append(char)
            continue

        if depth == 0 and (char.isspace() or char in {",", "/"}):
            token = "".join(current).strip()
            if token:
                tokens.append(token)
            current = []
            continue

        current.append(char)

    token = "".join(current).strip()
    if token:
        tokens.append(token)
    return tokens


def canonical_gate_name(raw_name: str) -> str:
    normalized = raw_name.strip().upper()
    if normalized not in GATE_ALIASES:
        supported = ", ".join(sorted(SUPPORTED_GATES))
        raise ValueError(f"Unsupported gate: {raw_name}. Supported gates: {supported}.")
    return GATE_ALIASES[normalized]


def parse_angle_expression(raw_text: str) -> float:
    expression = raw_text.strip()
    if not re.fullmatch(r"[0-9piPI+\-*/().\s]+", expression):
        raise ValueError(f"Unsupported rotation angle: {raw_text}")
    normalized = expression.replace("PI", "pi").replace("Pi", "pi").replace("pI", "pi")
    try:
        value = eval(normalized, {"__builtins__": {}}, {"pi": np.pi})
    except Exception as exc:
        raise ValueError(f"Could not parse rotation angle: {raw_text}") from exc
    angle = float(value)
    if not np.isfinite(angle):
        raise ValueError(f"Rotation angle must be finite: {raw_text}")
    return angle


def split_gate_arguments(raw_text: str) -> List[str]:
    args = []
    current = []
    depth = 0

    for char in raw_text:
        if char == "(":
            depth += 1
            current.append(char)
            continue
        if char == ")":
            depth = max(0, depth - 1)
            current.append(char)
            continue
        if char == "," and depth == 0:
            arg = "".join(current).strip()
            if arg:
                args.append(arg)
            current = []
            continue
        current.append(char)

    arg = "".join(current).strip()
    if arg:
        args.append(arg)
    return args


def parse_qubit_index(raw_text: str) -> int:
    raw_value = raw_text.strip()
    if not re.fullmatch(r"[0-9]+", raw_value):
        raise ValueError(f"Invalid qubit index: {raw_text}")
    qubit = int(raw_value)
    if qubit < 0 or qubit >= MAX_QUBITS:
        raise ValueError(
            f"Qubit index must be 0 or 1 for this two-qubit prototype: {raw_text}"
        )
    return qubit


def is_qubit_index_text(raw_text: str) -> bool:
    return re.fullmatch(r"[0-9]+", raw_text.strip()) is not None


def gate_label(family: str, args: List[str], qubits: List[int]) -> str:
    if family in TWO_QUBIT_GATES:
        return f"{family}({qubits[0]},{qubits[1]})"
    if not args:
        return family
    if family in ROTATION_GATES:
        return f"{family}({', '.join(args)})"
    return f"{family}({qubits[0]})"


def parse_gate_token(token: str) -> dict:
    token = token.strip()
    call_match = re.fullmatch(r"([A-Za-z]+)\((.*)\)", token)
    if call_match:
        family = canonical_gate_name(call_match.group(1))
        args = split_gate_arguments(call_match.group(2))
        if family in ROTATION_GATES:
            if len(args) == 1:
                angle_text = args[0]
                qubits = [0]
            elif len(args) == 2:
                if not is_qubit_index_text(args[0]):
                    raise ValueError(
                        f"{family} two-argument form must be {family}(qubit, angle), for example {family}(1, pi/2)."
                    )
                qubits = [parse_qubit_index(args[0])]
                angle_text = args[1]
            else:
                raise ValueError(
                    f"{family} needs an angle, optionally with one qubit index."
                )
            angle = parse_angle_expression(angle_text)
            return {
                "family": family,
                "angle": angle,
                "qubits": qubits,
                "label": gate_label(family, args, qubits),
            }

        if family in TWO_QUBIT_GATES:
            if len(args) != 2:
                raise ValueError(
                    f"{family} needs two qubit indexes, for example {family}(0,1)."
                )
            qubits = [parse_qubit_index(args[0]), parse_qubit_index(args[1])]
            if qubits[0] == qubits[1]:
                raise ValueError(f"{family} needs two different qubits.")
            return {
                "family": family,
                "angle": None,
                "qubits": qubits,
                "label": gate_label(family, args, qubits),
            }

        if len(args) != 1:
            raise ValueError(
                f"{family} needs one qubit index, for example {family}(1)."
            )
        qubits = [parse_qubit_index(args[0])]
        return {
            "family": family,
            "angle": None,
            "qubits": qubits,
            "label": gate_label(family, args, qubits),
        }

    family = canonical_gate_name(token)
    if family in ROTATION_GATES:
        raise ValueError(f"{family} needs an angle, for example {family}(pi/2).")
    qubits = [0, 1] if family in TWO_QUBIT_GATES else [0]
    return {
        "family": family,
        "angle": None,
        "qubits": qubits,
        "label": gate_label(family, [], qubits),
    }


def format_probability(value: float) -> str:
    percent = value * 100
    if np.isclose(percent, round(percent)):
        return str(int(round(percent)))
    return f"{percent:.1f}"


def cmyk_component_state(raw_name: str) -> str | None:
    normalized = raw_name.strip().lower()
    normalized = normalized.removeprefix("|").removesuffix(">")
    if normalized in CMYK_COLOUR_ALIASES:
        return CMYK_COLOUR_ALIASES[normalized]
    if normalized in {"00", "01", "10", "11"}:
        return normalized
    return None


def parse_cmyk_mix_component(raw_component: str) -> tuple[str, float] | None:
    component = raw_component.strip().lower()
    number = r"([0-9]*\.?[0-9]+)"
    colour = r"([a-z][a-z\s-]*|\|?[01]{2}>?)"

    leading_weight = re.fullmatch(rf"{number}\s*%?\s*{colour}", component)
    if leading_weight:
        state_key = cmyk_component_state(leading_weight.group(2))
        if state_key is not None:
            return state_key, float(leading_weight.group(1))

    trailing_weight = re.fullmatch(rf"{colour}\s*{number}\s*%?", component)
    if trailing_weight:
        state_key = cmyk_component_state(trailing_weight.group(1))
        if state_key is not None:
            return state_key, float(trailing_weight.group(2))

    state_key = cmyk_component_state(component)
    if state_key is not None:
        return state_key, 1.0

    return None


def parse_cmyk_mix(raw_text: str) -> tuple[np.ndarray, str] | None:
    components = [
        component.strip()
        for component in re.split(
            r"\s*(?:/|,|\band\b)\s*", raw_text.strip(), flags=re.IGNORECASE
        )
        if component.strip()
    ]
    if len(components) < 2:
        return None

    parsed_components = []
    for component in components:
        parsed = parse_cmyk_mix_component(component)
        if parsed is None:
            return None
        parsed_components.append(parsed)

    weights = {"00": 0.0, "01": 0.0, "10": 0.0, "11": 0.0}
    for state_key, weight in parsed_components:
        weights[state_key] += weight

    total = sum(weights.values())
    if total <= 0:
        raise ValueError("The CMYK colour weights must add up to more than zero.")

    probabilities = {state_key: weight / total for state_key, weight in weights.items()}
    state = np.array(
        [np.sqrt(probabilities[state_key]) for state_key in ("00", "01", "10", "11")],
        dtype=complex,
    )
    label_parts = [
        f"{format_probability(probabilities[state_key])} {STATE_NAMES[state_key]}"
        for state_key in ("00", "01", "10", "11")
        if probabilities[state_key] > 0
    ]
    return state, " / ".join(label_parts)


def parse_colour_basis_state(raw_text: str) -> tuple[np.ndarray, str]:
    raw_value = raw_text.strip()
    normalized = raw_value.lower()
    if normalized in TARGET_ALIASES:
        canonical = TARGET_ALIASES[normalized]
        return TARGET_STATES[canonical], STATE_NAMES[canonical]
    raise ValueError(
        "Please choose cyan, magenta, yellow, black, or a basis state: 00, 01, 10, or 11."
    )


def parse_colour_state(raw_text: str) -> tuple[np.ndarray, str]:
    raw_value = raw_text.strip()
    try:
        return parse_colour_basis_state(raw_value)
    except ValueError:
        pass

    cmyk_mix = parse_cmyk_mix(raw_value)
    if cmyk_mix is not None:
        return cmyk_mix

    raise ValueError(
        "Please choose CMYK colours, basis states like 01, or a mix like '50 cyan / 50 magenta'."
    )


def normalize_level_choice(raw_text: str) -> str:
    level = raw_text.strip().lower()
    if level not in LEVEL_ALIASES:
        raise ValueError(f"Please choose one of: {', '.join(sorted(LEVEL_ALIASES))}.")
    return LEVEL_ALIASES[level]


def parse_level_file(level_path: Path) -> dict:
    config = {}
    for raw_line in level_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"Invalid line in {level_path.name}: {raw_line}")
        key, value = line.split(":", 1)
        config[key.strip().lower()] = value.strip()

    required_fields = {
        "id",
        "title",
        "description",
        "max_gates",
        "allowed_gates",
        "order",
        "aliases",
        "target",
    }
    missing = sorted(required_fields - config.keys())
    if missing:
        raise ValueError(f"Missing fields in {level_path.name}: {', '.join(missing)}")

    try:
        allowed_gates = [
            canonical_gate_name(gate)
            for gate in config["allowed_gates"].split(",")
            if gate.strip()
        ]
    except ValueError as exc:
        raise ValueError(f"{level_path.name}: {exc}") from exc

    target_value = config["target"].strip()
    if target_value.lower() == "none":
        target_state = None
        target_label = None
    else:
        target_state, target_label = parse_colour_state(target_value)

    start_state, start_label = parse_colour_basis_state(config.get("start", "black"))

    aliases = [
        alias.strip().lower() for alias in config["aliases"].split(",") if alias.strip()
    ]
    if not aliases:
        raise ValueError(f"No aliases provided in {level_path.name}")

    return {
        "id": config["id"].strip().lower(),
        "title": config["title"].strip(),
        "description": config["description"].strip(),
        "max_gates": int(config["max_gates"]),
        "allowed_gates": allowed_gates,
        "order": int(config["order"]),
        "aliases": aliases,
        "start_state": start_state,
        "start_label": start_label,
        "target_state": target_state,
        "target_label": target_label,
        "file_name": level_path.name,
    }


def load_levels():
    level_paths = sorted(LEVELS_DIR.glob("*.txt"))
    if not level_paths:
        raise FileNotFoundError(f"No level files found in {LEVELS_DIR}")

    levels = {}
    level_aliases = {}
    ordered_ids = []

    loaded_levels = [parse_level_file(level_path) for level_path in level_paths]
    for level in sorted(loaded_levels, key=lambda item: (item["order"], item["title"])):
        level_id = level["id"]
        levels[level_id] = level
        ordered_ids.append(level_id)
        for alias in level["aliases"]:
            level_aliases[alias] = level_id
        level_aliases[level_id] = level_id

    return levels, level_aliases, ordered_ids


LEVELS, LEVEL_ALIASES, LEVEL_ORDER = load_levels()


def validate_gate_sequence(
    gates: List[dict],
    allowed_gates: List[str] | None = None,
    max_gates: int | None = None,
):
    if max_gates is not None and len(gates) > max_gates:
        raise ValueError(f"You can use at most {max_gates} gates in this mode.")

    if allowed_gates is not None:
        disallowed = [
            gate["family"] for gate in gates if gate["family"] not in allowed_gates
        ]
        if disallowed:
            allowed_text = ", ".join(allowed_gates)
            raise ValueError(f"This mode only allows these gates: {allowed_text}.")


def gate_matrix(gate: dict) -> np.ndarray:
    family = gate["family"]
    if family in FIXED_GATES:
        return FIXED_GATES[family]

    theta = gate["angle"]
    half_theta = theta / 2
    if family == "RX":
        return np.array(
            [
                [np.cos(half_theta), -1j * np.sin(half_theta)],
                [-1j * np.sin(half_theta), np.cos(half_theta)],
            ],
            dtype=complex,
        )
    if family == "RY":
        return np.array(
            [
                [np.cos(half_theta), -np.sin(half_theta)],
                [np.sin(half_theta), np.cos(half_theta)],
            ],
            dtype=complex,
        )
    if family == "RZ":
        return np.array(
            [
                [np.exp(-1j * half_theta), 0],
                [0, np.exp(1j * half_theta)],
            ],
            dtype=complex,
        )
    raise ValueError(f"Unsupported gate family: {family}")


def qubit_count_for_state(state: np.ndarray) -> int:
    size = len(state)
    qubit_count = int(np.log2(size))
    if 2**qubit_count != size:
        raise ValueError(f"State vector length must be a power of 2, got {size}.")
    if qubit_count > MAX_QUBITS:
        raise ValueError(f"This prototype supports at most {MAX_QUBITS} qubits.")
    return qubit_count


def infer_qubit_count(
    gates: Iterable[dict], start_state: np.ndarray | None = None
) -> int:
    state = np.array(
        start_state if start_state is not None else INITIAL_STATE, dtype=complex
    )
    qubit_count = qubit_count_for_state(state)
    for gate in gates:
        qubit_count = max(qubit_count, max(gate["qubits"]) + 1)
    return qubit_count


def expand_state(state: np.ndarray, qubit_count: int) -> np.ndarray:
    expanded = np.array(state, dtype=complex)
    current_qubits = qubit_count_for_state(expanded)
    if current_qubits > qubit_count:
        raise ValueError("Cannot shrink the starting state to fewer qubits.")
    while current_qubits < qubit_count:
        expanded = np.kron(expanded, np.array([1, 0], dtype=complex))
        current_qubits += 1
    return expanded


def apply_single_qubit_gate(
    state: np.ndarray, matrix: np.ndarray, target: int, qubit_count: int
) -> np.ndarray:
    tensor = state.reshape([2] * qubit_count)
    tensor = np.moveaxis(tensor, target, 0)
    updated = np.tensordot(matrix, tensor, axes=([1], [0]))
    updated = np.moveaxis(updated, 0, target)
    return updated.reshape(-1)


def qubit_bit_mask(qubit: int, qubit_count: int) -> int:
    return 1 << (qubit_count - qubit - 1)


def apply_cnot_gate(
    state: np.ndarray, control: int, target: int, qubit_count: int
) -> np.ndarray:
    output = np.zeros_like(state)
    control_mask = qubit_bit_mask(control, qubit_count)
    target_mask = qubit_bit_mask(target, qubit_count)
    for index, amplitude in enumerate(state):
        output[index ^ target_mask if index & control_mask else index] += amplitude
    return output


def apply_swap_gate(
    state: np.ndarray, first: int, second: int, qubit_count: int
) -> np.ndarray:
    output = np.zeros_like(state)
    first_mask = qubit_bit_mask(first, qubit_count)
    second_mask = qubit_bit_mask(second, qubit_count)
    for index, amplitude in enumerate(state):
        first_bit = bool(index & first_mask)
        second_bit = bool(index & second_mask)
        target_index = (
            index ^ first_mask ^ second_mask if first_bit != second_bit else index
        )
        output[target_index] += amplitude
    return output


def apply_cphase_gate(
    state: np.ndarray, control: int, target: int, qubit_count: int
) -> np.ndarray:
    output = np.array(state, dtype=complex)
    control_mask = qubit_bit_mask(control, qubit_count)
    target_mask = qubit_bit_mask(target, qubit_count)
    for index in range(len(output)):
        if index & control_mask and index & target_mask:
            output[index] *= -1
    return output


def gate_display(gate: dict) -> str:
    return gate["label"]


def format_qasm_angle(angle: float) -> str:
    return f"{angle:.12f}".rstrip("0").rstrip(".")


def gate_qasm(gate: dict) -> str:
    family = gate["family"]
    qubits = gate["qubits"]
    if family == "I":
        return ""
    if family == "RX":
        angle_text = format_qasm_angle(gate["angle"])
        target = qubits[0]
        return f"h q[{target}];\nrz({angle_text}) q[{target}];\nh q[{target}];"
    if family in ROTATION_GATES:
        return f"{family.lower()}({format_qasm_angle(gate['angle'])}) q[{qubits[0]}];"
    if family == "CNOT":
        return f"cx q[{qubits[0]}],q[{qubits[1]}];"
    if family == "SWAP":
        return "\n".join(
            [
                f"cx q[{qubits[0]}],q[{qubits[1]}];",
                f"cx q[{qubits[1]}],q[{qubits[0]}];",
                f"cx q[{qubits[0]}],q[{qubits[1]}];",
            ]
        )
    if family == "CPHASE":
        return "\n".join(
            [
                f"h q[{qubits[1]}];",
                f"cx q[{qubits[0]}],q[{qubits[1]}];",
                f"h q[{qubits[1]}];",
            ]
        )
    return f"{family.lower()} q[{qubits[0]}];"


def basis_state_index(state: np.ndarray) -> int | None:
    nonzero_indexes = np.flatnonzero(np.abs(state) > 1e-9)
    if len(nonzero_indexes) != 1:
        return None
    index = int(nonzero_indexes[0])
    if np.isclose(abs(state[index]), 1.0, atol=1e-9):
        return index
    return None


def qasm_prepare_basis_state(state: np.ndarray, qubit_count: int) -> List[str]:
    index = basis_state_index(state)
    if index is None:
        raise ValueError(
            "QASM preparation currently supports computational-basis starting colours only."
        )

    lines = []
    for qubit in range(qubit_count):
        if index & qubit_bit_mask(qubit, qubit_count):
            lines.append(f"x q[{qubit}];")
    return lines


def apply_gates(
    gates: Iterable[dict], start_state: np.ndarray | None = None
) -> np.ndarray:
    gates = list(gates)
    qubit_count = infer_qubit_count(gates, start_state=start_state)
    state = expand_state(
        np.array(
            start_state if start_state is not None else INITIAL_STATE, dtype=complex
        ),
        qubit_count,
    )
    for gate in gates:
        family = gate["family"]
        qubits = gate["qubits"]
        if family == "CNOT":
            state = apply_cnot_gate(state, qubits[0], qubits[1], qubit_count)
        elif family == "SWAP":
            state = apply_swap_gate(state, qubits[0], qubits[1], qubit_count)
        elif family == "CPHASE":
            state = apply_cphase_gate(state, qubits[0], qubits[1], qubit_count)
        else:
            state = apply_single_qubit_gate(
                state, gate_matrix(gate), qubits[0], qubit_count
            )
    return state


def build_qasm(gates: Iterable[dict], start_state: np.ndarray | None = None) -> str:
    gates = list(gates)
    qubit_count = infer_qubit_count(gates, start_state=start_state)
    lines = [
        "OPENQASM 2.0;",
        f"qreg q[{qubit_count}];",
        f"creg c[{qubit_count}];",
    ]
    initial_state = np.array(
        start_state if start_state is not None else INITIAL_STATE, dtype=complex
    )
    initial_qubit_count = qubit_count_for_state(initial_state)
    if initial_qubit_count == 1:
        theta = 2 * np.arctan2(np.abs(initial_state[1]), np.abs(initial_state[0]))
        if not np.isclose(theta, 0.0):
            lines.append(f"ry({theta:.12f}) q[0];")
    else:
        lines.extend(qasm_prepare_basis_state(initial_state, qubit_count))
    for gate in gates:
        qasm_line = gate_qasm(gate)
        if qasm_line:
            lines.append(qasm_line)
    for qubit in range(qubit_count):
        lines.append(f"measure q[{qubit}] -> c[{qubit}];")
    return "\n".join(lines) + "\n"


def write_qasm(program: str, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(program)
    return output_path


def states_match_up_to_global_phase(
    actual: np.ndarray, desired: np.ndarray, tolerance: float = 1e-9
) -> bool:
    if actual.shape != desired.shape:
        return False
    overlap = np.vdot(desired, actual)
    return bool(np.isclose(abs(overlap), 1.0, atol=tolerance))


def int_to_measurement(value: int, qubit_count: int):
    if value < 0 or value >= 2**qubit_count:
        raise ValueError(f"Unexpected measurement value: {value}")
    if qubit_count == 1:
        return value
    return tuple(
        (value >> (qubit_count - qubit - 1)) & 1 for qubit in range(qubit_count)
    )


def normalize_measurement_value(raw_value, qubit_count: int):
    if isinstance(raw_value, int):
        return int_to_measurement(raw_value, qubit_count)
    if isinstance(raw_value, list) and len(raw_value) == qubit_count:
        if all(isinstance(bit, int) and bit in (0, 1) for bit in raw_value):
            return raw_value[0] if qubit_count == 1 else tuple(raw_value)
    raise ValueError(f"Unexpected measurement value: {raw_value}")


def normalize_measurements(raw_measurements, qubit_count: int):
    if not isinstance(raw_measurements, list):
        raise ValueError(
            f"Unexpected Quokka result type: {type(raw_measurements).__name__}"
        )

    shots = []
    for measurement in raw_measurements:
        shots.append(normalize_measurement_value(measurement, qubit_count))

    return shots


def extract_quokka_measurements(response_payload, qubit_count: int):

    if (
        isinstance(response_payload.get("result"), dict)
        and "c" in response_payload["result"]
    ):
        return normalize_measurements(response_payload["result"]["c"], qubit_count)

    if "c" in response_payload:
        return normalize_measurements(response_payload["c"], qubit_count)

    if (
        isinstance(response_payload.get("data"), dict)
        and "c" in response_payload["data"]
    ):
        return normalize_measurements(response_payload["data"]["c"], qubit_count)

    raise ValueError(f"Unexpected Quokka response payload: {response_payload}")


def send_to_quokka(
    program: str, count: int, my_quokka: str = "quokka1", qubit_count: int = 1
):
    request_http = f"http://{my_quokka}.quokkacomputing.com/qsim/qasm"
    data = {
        "script": program,
        "count": count,
    }
    response = requests.post(request_http, json=data, verify=False)
    response.raise_for_status()
    json_obj = response.json()
    obj = extract_quokka_measurements(json_obj, qubit_count)
    return obj


def collect_measurements(program: str, shots: int, quokka_name: str, qubit_count: int):
    try:
        return send_to_quokka(
            program, count=shots, my_quokka=quokka_name, qubit_count=qubit_count
        )
    except Exception as exc:
        raise RuntimeError(f"Quokka request failed: {exc}") from exc


def measurement_label(measurement) -> str:
    if isinstance(measurement, tuple):
        return "".join(str(bit) for bit in measurement)
    if isinstance(measurement, str):
        return measurement
    return str(int(measurement))


def measurement_counts(measurements: Iterable) -> dict[str, int]:
    counts: dict[str, int] = {}
    for measurement in measurements:
        label = measurement_label(measurement)
        counts[label] = counts.get(label, 0) + 1
    return counts


def state_name(bit_value) -> str:
    label = measurement_label(bit_value)
    return STATE_NAMES.get(label, label)


def default_plot_path(qasm_path: Path) -> Path:
    return qasm_path.with_name(f"{qasm_path.stem}_measurements.png")


def measurement_color(measurement) -> str:
    label = measurement_label(measurement)
    if label in CMYK_COLORS:
        return CMYK_COLORS[label]
    if label in {"0", "1"}:
        return BIT_COLORS[int(label)]
    return "#555555"


def plot_measurements(measurements: Iterable, plot_path: Path) -> Path:
    measurements = list(measurements)
    plot_path.parent.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng()
    xs = rng.uniform(0.02, 0.98, size=len(measurements))
    ys = rng.uniform(0.02, 0.98, size=len(measurements))
    is_cmyk_plot = any(isinstance(measurement, tuple) for measurement in measurements)

    fig, ax = plt.subplots(figsize=(2.8, 2.8), dpi=180)
    fig.set_facecolor("#d8d2c4")
    ax.set_facecolor("#d8d2c4")

    labels = sorted(measurement_counts(measurements))
    for label in labels:
        mask = np.array(
            [measurement_label(measurement) == label for measurement in measurements]
        )
        ax.scatter(
            xs[mask],
            ys[mask],
            s=260 if is_cmyk_plot else 180,
            c=measurement_color(label),
            alpha=0.28 if is_cmyk_plot else 0.4,
            edgecolors="none",
            label=f"{state_name(label)} |{label}>",
        )

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_color("#444444")
        spine.set_linewidth(1.0)

    ax.set_title("Measured Colour Mix", fontsize=12, color="#222222", pad=8)

    fig.tight_layout()
    fig.savefig(str(plot_path), bbox_inches="tight")
    plt.close(fig)
    return plot_path


def build_dot_strip(measurements: Iterable, max_dots: int = 60) -> str:
    measurements = list(measurements)
    if not measurements:
        return ""
    if len(measurements) <= max_dots:
        sample = measurements
    else:
        step = len(measurements) / max_dots
        sample = [measurements[int(i * step)] for i in range(max_dots)]
    symbols = {
        "0": ".",
        "1": "o",
        "00": ".",
        "01": ":",
        "10": "o",
        "11": "@",
    }
    return "".join(
        symbols.get(measurement_label(measurement), "?") for measurement in sample
    )


def print_round_report(
    mode_name: str,
    start_label: str,
    target_label: str | None,
    target_state: np.ndarray | None,
    gates: List[dict],
    state: np.ndarray,
    measurements: List[int],
    qasm_path: Path,
    plot_path: Path,
):
    success = (
        None
        if target_state is None
        else states_match_up_to_global_phase(state, target_state)
    )

    print()
    print("Round result")
    print(f"Mode: {mode_name}")
    print(f"Starting colour: {start_label}")
    if target_label is None:
        print("Target colour: none in playground mode")
    else:
        print(f"Target colour: {target_label}")
    print(
        f"Gates used: {' '.join(gate_display(gate) for gate in gates) if gates else '(none)'}"
    )
    print(f"QASM file: {qasm_path}")
    print(f"Measurement plot: {plot_path}")
    print()
    if any(isinstance(measurement, tuple) for measurement in measurements):
        print(
            "Colour strip (. = cyan |00>, : = magenta |01>, o = yellow |10>, @ = black |11>):"
        )
    print(build_dot_strip(measurements))
    print()
    if success is None:
        print("Playground mode: no target check for this round.")
    else:
        print(
            "YAY: you reached the target colour."
            if success
            else "NAY: you did not reach the target colour."
        )
    print()


def print_round_error(
    mode_name: str,
    start_label: str,
    target_label: str | None,
    gates: List[dict],
    qasm_path: Path,
    error_message: str,
):
    print()
    print("Round error")
    print(f"Mode: {mode_name}")
    print(f"Starting colour: {start_label}")
    if target_label is None:
        print("Target colour: none in playground mode")
    else:
        print(f"Target colour: {target_label}")
    print(
        f"Gates used: {' '.join(gate_display(gate) for gate in gates) if gates else '(none)'}"
    )
    print(f"QASM file: {qasm_path}")
    print()
    print("Quokka error:")
    print(error_message)
    print("No measurements were returned for this round.")
    print()


def run_round(
    mode_name: str,
    start_state: np.ndarray,
    start_label: str,
    target_state: np.ndarray | None,
    target_label: str | None,
    gate_text: str,
    shots: int,
    quokka_name: str,
    qasm_path: Path,
    allowed_gates: List[str] | None = None,
    max_gates: int | None = None,
):
    gates = parse_gate_input(gate_text)
    validate_gate_sequence(gates, allowed_gates=allowed_gates, max_gates=max_gates)
    qubit_count = infer_qubit_count(gates, start_state=start_state)
    state = apply_gates(gates, start_state=start_state)
    program = build_qasm(gates, start_state=start_state)
    write_qasm(program, qasm_path)
    try:
        measurements = collect_measurements(program, shots, quokka_name, qubit_count)
    except RuntimeError as exc:
        print_round_error(
            mode_name, start_label, target_label, gates, qasm_path, str(exc)
        )
        return False
    plot_path = plot_measurements(measurements, default_plot_path(qasm_path))
    print_round_report(
        mode_name,
        start_label,
        target_label,
        target_state,
        gates,
        state,
        measurements,
        qasm_path,
        plot_path,
    )
    return True


def print_gate_help(allowed_gates: List[str]):
    print("Available gates:")
    for gate in allowed_gates:
        print(f"  {gate}: {GATE_DESCRIPTIONS[gate]}")


def print_level_intro(level_key: str):
    level = LEVELS[level_key]
    print()
    print(level["title"])
    print(level["description"])
    print(f"Starting colour: {level['start_label']}")
    print(f"Maximum gates: {level['max_gates']}")
    print_gate_help(level["allowed_gates"])
    print()


def prompt_level() -> str:
    while True:
        print("Choose a mode:")
        for level_id in LEVEL_ORDER:
            level = LEVELS[level_id]
            prompt_alias = level["aliases"][0]
            print(f"  {prompt_alias}: {level['title']}")
        try:
            return normalize_level_choice(input("Enter your choice: "))
        except ValueError as exc:
            print(exc)
            print()


def prompt_gate_text(allowed_gates: List[str], max_gates: int) -> str:
    gate_word = "gate" if max_gates == 1 else "gates"
    while True:
        gate_text = input(
            f"Enter up to {max_gates} {gate_word} from allowed gates "
            f"({', '.join(allowed_gates)}). Press Enter for no gate: "
        ).strip()
        try:
            gates = parse_gate_input(gate_text)
            validate_gate_sequence(
                gates, allowed_gates=allowed_gates, max_gates=max_gates
            )
            return gate_text
        except ValueError as exc:
            print(exc)


def prompt_next_action() -> str:
    while True:
        answer = (
            input("Choose next action: replay level (r), level menu (m), or quit (q): ")
            .strip()
            .lower()
        )
        if answer in {"r", "replay"}:
            return "replay"
        if answer in {"m", "menu"}:
            return "menu"
        if answer in {"q", "quit"}:
            return "quit"
        print("Please enter r, m, or q.")


def play_level(level: dict, args):
    while True:
        print()
        print(level["title"])
        print(level["description"])
        print(f"Starting colour: {level['start_label']}")
        print(f"Maximum gates: {level['max_gates']}")
        print_gate_help(level["allowed_gates"])
        print()

        gate_text = prompt_gate_text(level["allowed_gates"], level["max_gates"])
        run_round(
            mode_name=level["title"],
            start_state=level["start_state"],
            start_label=level["start_label"],
            target_state=level["target_state"],
            target_label=level["target_label"],
            gate_text=gate_text,
            shots=args.shots,
            quokka_name=args.quokka,
            qasm_path=Path(args.output),
            allowed_gates=level["allowed_gates"],
            max_gates=level["max_gates"],
        )
        next_action = prompt_next_action()
        if next_action == "replay":
            continue
        if next_action == "menu":
            print()
            return "menu"
        return "quit"


def interactive_game(args):
    print("Quantum Colour Mixer - Prototype")
    print("Choose a level and use quantum gates to reach the target colour.")
    print()

    while True:
        level_key = prompt_level()
        level = LEVELS[level_key]
        if play_level(level, args) == "quit":
            return


def build_parser():
    parser = argparse.ArgumentParser(description="Colour mixer the quantum way.")
    parser.add_argument(
        "--level",
        help="Start the game using a level file path, for example: levels/lv1.txt.",
    )
    parser.add_argument(
        "--start",
        default="black",
        help="Starting colour for custom mode: cyan, magenta, yellow, black, or 00/01/10/11.",
    )
    parser.add_argument(
        "--target",
        help="Desired final colour or mix for custom mode, for example: magenta, 01, or '50 cyan / 50 magenta'.",
    )
    parser.add_argument(
        "--gates",
        default="",
        help="Gate list to apply to your starting colour, for example: 'H(1)' or 'X(0) / X(1)'.",
    )
    parser.add_argument(
        "--shots", type=int, default=500, help="Number of measurements to request."
    )
    parser.add_argument(
        "--quokka", default="quokka1", help="Quokka name, for example quokka1."
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Where to write the generated QASM file.",
    )
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.shots <= 0:
        parser.error("--shots must be a positive integer.")

    if args.level is not None:
        if args.target is not None:
            parser.error("--level cannot be used together with --target.")
        if args.start != "black":
            parser.error(
                "--level uses the level's own starting colour, so do not pass --start."
            )
        if args.gates:
            parser.error(
                "--level starts the interactive level flow, so do not pass --gates."
            )

        try:
            level = parse_level_file(Path(args.level))
        except (OSError, ValueError) as exc:
            parser.error(str(exc))

        print("Quantum Colour Mixer - Prototype")
        print("Loaded level from file.")
        play_level(level, args)
        return

    if args.target is None:
        interactive_game(args)
        return

    try:
        start_state, start_label = parse_colour_basis_state(args.start)
        target_state, target_label = parse_colour_state(args.target)
    except ValueError as exc:
        parser.error(str(exc))

    run_round(
        mode_name="Custom Mode",
        start_state=start_state,
        start_label=start_label,
        target_state=target_state,
        target_label=target_label,
        gate_text=args.gates,
        shots=args.shots,
        quokka_name=args.quokka,
        qasm_path=Path(args.output),
    )


if __name__ == "__main__":
    main()
