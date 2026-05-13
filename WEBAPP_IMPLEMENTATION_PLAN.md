# Browser Webapp Rewrite Plan

## Summary

Build a React + Vite + TypeScript webapp that preserves the current game mechanics and lets users play levels and playground from a browser. Because Quokka does not appear to return browser CORS headers, the browser must call a same-origin `/api/quokka` proxy; that proxy forwards QASM jobs to `https://quokka1.quokkacomputing.com/qsim/qasm`.

Recommended deployment: Cloudflare Pages, because it can host the static Vite app and the Pages Function proxy in one project. Local development should run the built frontend and proxy through Wrangler.

## Architecture And Technology

- Frontend: React + Vite + TypeScript.
- Styling: plain CSS with CSS variables.
- Backend: one Cloudflare Pages Function, `POST /api/quokka`, used only to forward `{ script, count, quokkaName }` to Quokka and normalize errors.
- Hosting: Cloudflare Pages for hosted app; localhost via `pnpm dev` using Wrangler.
- Testing: Vitest for game-engine unit tests; React Testing Library can be added later for core UI behavior.

## Key Implementation Changes

- Port the Python game engine into pure TypeScript modules:
  - Gate parsing, aliases, angle parsing, level validation, target parsing, state-vector simulation, QASM generation, measurement normalization, and target matching.
  - Use browser-native arrays and a small `Complex` helper instead of NumPy.
  - Keep the current two-qubit limit and current gate set: `I`, `X`, `Y`, `Z`, `H`, `RX`, `RY`, `RZ`, `CNOT`, `SWAP`, `CPHASE`.
- Convert `levels/*.txt` into checked-in JSON data:
  - Keep the same level content and constraints.
  - Include playground as a normal mode with `target: null`.
- Build a browser UI with:
  - Level menu.
  - Current level description, start colour, target mix, allowed gates, max gates, and hint.
  - Gate builder controls for selecting gates/qubits/angles, plus a raw gate-text input for parity with CLI examples.
  - Circuit/gate sequence preview with remove/reset controls.
  - Run button that generates QASM, calls `/api/quokka`, displays measurements, and shows YAY/NAY based on local simulated probabilities.
  - Playground mode with no target check.
- Replace Matplotlib output with browser rendering:
  - Use SVG for the semi-transparent measurement-dot colour plot.
  - Show counts/proportions and the existing symbolic strip equivalent.
- Keep QASM visible/downloadable in the UI for transparency and debugging.
- Keep notes about the removed Python CLI in `PROJECT_FINDINGS.md` so a future Node CLI can reuse the TypeScript game engine.

## API Interface

- `POST /api/quokka`
  - Request body: `{ "script": string, "count": number, "quokkaName": "quokka1" | string, "qubitCount": 1 | 2 }`
  - Response success: `{ "measurements": Array<number | number[]> }`
  - Response failure: `{ "error": string }` with a non-2xx status.
- The proxy must:
  - Enforce positive `count`.
  - Restrict `qubitCount` to `1` or `2`.
  - Default `quokkaName` to `quokka1`.
  - Call Quokka over HTTPS.
  - Not decide game success; success remains client-side from simulated probabilities.

## Test Plan

- Unit-test TypeScript parity against current examples:
  - `H(1)` from cyan matches 50 cyan / 50 magenta.
  - `H(0) / CNOT(0,1)` from cyan matches 50 cyan / 50 black.
  - `RY(1, pi/3)` from cyan matches 75 cyan / 25 magenta within tolerance.
  - `RY(1, pi/3) / SWAP(0,1)` from cyan matches 75 cyan / 25 yellow.
- Unit-test parsing errors:
  - Unsupported gates.
  - Invalid qubit indexes.
  - Invalid rotation angles.
  - Too many gates for a level.
  - Disallowed gates for a level.
- Unit-test QASM generation for each supported gate family.
- Manual acceptance:
- `pnpm dev` opens a playable localhost app.
- Hosted Cloudflare Pages deployment can complete at least one Quokka-backed run.
  - Browser console has no CORS errors when calling `/api/quokka`.

## Assumptions

- Quokka remains required for measurement sampling, but game success is still computed locally from simulated probabilities, matching the current Python behavior.
- Direct browser-to-Quokka calls are out of scope because the observed HTTPS preflight response lacks `Access-Control-Allow-Origin`.
- React + Vite is the chosen frontend stack.
- First release targets current feature parity: bundled levels plus playground, not expanded tutorials or user-created level editing.
