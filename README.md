# Colour Mixer, a quantum game

This is a game designed to introduce basic quantum operations and measurements. Players are given a set of basic colours (aka the bases set), a starting colour (initial state), and a handful of mixer magics (quatum gates) that allow them to perform state flips, rotations, superpositionsm and entanglements. The aim is to generate the target colour using any combination of magics.

## AI disclaimer

OpenAI codex was used to write part of the functions, and was involved in debugging. All code is reviewed by human.

The game mechanism and the levels are purely done by human.

## Prototype

This prototype uses a two-qubit CMYK model with the four computational basis states:

- `|00>`: cyan
- `|01>`: magenta
- `|10>`: yellow
- `|11>`: black

When the game starts, it asks the player which mode to enter:

- `Level 1`: start from cyan `|00>`, target a 50-50 cyan/magenta mix, using one `H` gate.
- `Playground`: build your own circuit with the available single-qubit and two-qubit gates.

The levels are defined in [levels](./levels).

In each level, player will have access to ristricted magics, and can only input no more than a certain number of magics.

There is no "standard answer" - use any combination of magics within the constraints to create target colour and you will get a YAY!

## Playground

There's no target here. Default starting colour is black. Apply any magic available to create your own superposition! Maximum 10 magics. Playground supports single-qubit gates and the two-qubit gates `CNOT`, `SWAP`, and `CPHASE`.

## Play the game

Interactive levels:

```bash
python quantum_game.py
```

Two-qubit CMYK tutorial target:

```bash
python quantum_game.py --start cyan --target "50 cyan / 50 magenta" --gates "H(1)" --shots 500
```

Two-qubit gates use explicit qubit indexes:

```bash
python quantum_game.py --start cyan --target 11 --gates "X(0) / X(1)" --shots 500
python quantum_game.py --start cyan --target "50 cyan / 50 black" --gates "H(0) / CNOT(0,1)" --shots 500
```

## Write your own level

Each level is just a .txt file. You can create your own level by editing the existing levels file.

Run the game from a file path to the level file:

```bash
python quantum_game.py --level levels/lv1.txt
```


## Notes

- Supported gates: `I` as a game-level no-op, plus Quokka-backed `X`, `Y`, `Z`, `H`, `RX`, `RY`, `RZ`, `CNOT`, `SWAP`, and `CPHASE`.
- `--start` accepts only the four CMYK colours or basis states: `cyan`, `magenta`, `yellow`, `black`, `00`, `01`, `10`, or `11`.
- `--target` accepts a CMYK colour, a basis state like `01`, or a weighted mix like `"50 cyan / 50 magenta"`.
- Single-qubit gates default to qubit 0. For rotation gates with two arguments, the first argument must be the qubit number and the second must be the angle, for example `RX(1, pi/2)`, `RY(1, pi/3)`, or `RZ(1, -pi/4)`.
- Two-qubit gates use syntax like `CNOT(0,1)`, `SWAP(0,1)`, and `CPHASE(0,1)`.
- `RX(theta)` is compiled to `H RZ(theta) H` before sending QASM to Quokka, because the live Quokka backend accepts `RZ` and `H` but currently rejects direct `RX`.
- `SWAP` is compiled to three `CNOT` gates, and `CPHASE` is compiled to `H`, `CNOT`, `H`.
- Measurement plots draw every shot as a semi-transparent coloured circle in a box, so overlapping circles visually mimic a mixed colour.
- Quokka access is required for measurements.
