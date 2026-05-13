# Colour Mixer, a quantum game

This is a game designed to introduce basic quantum operations and measurements. Players are given a set of basic colours (aka the bases set), a starting colour (initial state), and a handful of mixer magics (quatum gates) that allow them to perform state flips, rotations, superpositionsm and entanglements. The aim is to generate the target colour using any combination of magics.

## Play the webapp

The primary version is now a React + Vite webapp. It runs the game UI and local target checking in the browser, then sends generated OpenQASM to Quokka through a same-origin `/api/quokka` Cloudflare Pages Function. The proxy is required because the Quokka endpoint is not browser-CORS-enabled.

Install dependencies:

```bash
npm install
```

Run locally with Cloudflare Wrangler so `/api/quokka` is available:

```bash
npm run dev
```

For frontend-only development without Quokka calls:

```bash
npm run dev:vite
```

Build and test:

```bash
npm run build
npm test
```

## Publishing domain

The public hosting domain is configured through `VITE_PUBLIC_SITE_URL`. The default sentinel value is:

```bash
VITE_PUBLIC_SITE_URL=__DOMAIN_NOT_CONFIGURED__
```

For the intended production domain, set:

```bash
VITE_PUBLIC_SITE_URL=https://quantum-color.theos.me
```

You can set this in `.env.local` for local builds, or as a Cloudflare Pages environment variable for production. `npm run deploy` refuses to publish while the sentinel value is still active.

The app can be hosted on Cloudflare Pages. Use `npm run build` as the build command and `dist` as the output directory. The Quokka proxy lives at `functions/api/quokka.ts`.

Deploy from the CLI if the project is already linked to Cloudflare:

```bash
npm run deploy
```

## AI disclaimer

OpenAI codex was used to write part of the functions, and was involved in debugging. All code is reviewed by human.

The game mechanism and the levels are purely done by human.

## Legacy Python CLI

```bash
python quantum_game.py
```

## Playing around CMYK colours

Don't panic. We are using two qubits to give you any combination of four basis colours:
- `|00>`: cyan
- `|01>`: magenta
- `|10>`: yellow
- `|11>`: black

When the game starts, you can choose from the preset levels, or playground:

- `Level 1 - Mix Cyan`: a 50-50 cyan/magenta mix from one Hadamard.
- `Level 2 - Blendy Blend`: an even four-colour mix from independent superpositions.
- `Level 3 - Forbidden Colours`: a cyan/black blend that introduces entanglement.
- `Level 4 - Weighted Purple`: an approximate 75/25 cyan/magenta blend using `RY`.
- `Level 5 - Swap Around`: a weighted cyan/yellow blend that teaches `SWAP`.
- `Playground`: build your own circuit with the available single-qubit and two-qubit gates.

The levels are defined in [levels](./levels).

In each level, you will have access to ristricted magics, and can only input no more than a certain number of magics.

There is no "standard answer" - use any combination of magics within the constraints to create target colour and you will get a YAY!

## Magics

Magics are single-qubit gates and two-qubit gates. Here we provide a simple yet powerful set of "universal gates": you can theoretically reach any colour mix with these gates.

### Single-qubit gates:
- `X`: state flip
- `Y`: phase flip
- `Z`: state & phase flip
- `RX`, `RY`, `RZ`: rotations around `x`, `y`, or `z` axis

Single-qubit gates default to qubit 0. For rotation gates with two arguments, the first argument must be the qubit number and the second must be the angle, for example `RX(1, pi/2)`, `RY(1, pi/3)`, or `RZ(1, -pi/4)`

### Two-qubit gates:
- `CNOT`: controlled-NOT
- `SWAP`: ...swap.
- `CPHASE`: controlled phase flip

Use syntax like `CNOT(0,1)`, `SWAP(0,1)`, and `CPHASE(0,1)`.

## Playground

There's no target here. Default starting colour is black. Apply any magic available to create your own superposition! Maximum 10 magics. Playground supports single-qubit gates and the two-qubit gates `CNOT`, `SWAP`, and `CPHASE`.

## Write your own level

Each level is just a .txt file. You can create your own level by editing the existing levels file.

Run the game from a file path to the level file:

```bash
python quantum_game.py --level levels/lv1.txt
```

## Start a single custom play run

```bash
python quantum_game.py --start cyan --target "50 cyan / 50 magenta" --gates "H(1)" --shots 500
```

```bash
python quantum_game.py --start cyan --target "50 cyan / 50 black" --gates "H(0) / CNOT(0,1)" --shots 500
```

```bash
python quantum_game.py --start cyan --target "75 cyan / 25 magenta" --gates "RY(1, pi/3)" --shots 500
```

```bash
python quantum_game.py --start cyan --target "75 cyan / 25 yellow" --gates "RY(1, pi/3) / SWAP(0,1)" --shots 500
```

## Notes

- Supported gates: `I` as a game-level no-op, plus Quokka-backed `X`, `Y`, `Z`, `H`, `RX`, `RY`, `RZ`, `CNOT`, `SWAP`, and `CPHASE`.
- `--start` accepts only the basis states: `cyan`, `magenta`, `yellow`, `black`, `00`, `01`, `10`, or `11`.
- `--target` accepts a CMYK colour, a basis state like `01`, or a weighted mix like `"50 cyan / 50 magenta"`.
- Level success is checked against the target colour probabilities, not exact quantum phase. That keeps colour-mixing levels intuitive and allows some tolerance where appropriate.
- Measurement plots draw every shot as a semi-transparent coloured circle in a box, so overlapping circles visually mimic a mixed colour.
- Quokka access is required for measurements.
