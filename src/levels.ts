import { parseColourBasisState, parseColourState } from "./game/colour";
import type { GateFamily, Level } from "./game/types";

type LevelDefinition = {
  id: string;
  title: string;
  description: string;
  hint?: string;
  start?: string;
  target: string | null;
  maxGates: number;
  allowedGates: GateFamily[];
  order: number;
  aliases: string[];
  targetTolerance?: number;
};

const definitions: LevelDefinition[] = [
  {
    id: "1",
    title: "Level 1 - Mix Cyan",
    description: "Start from cyan |00> and create a 50-50 cyan/magenta mix.",
    hint: "Changing one qubit is enough to create a blend.",
    start: "cyan",
    target: "50 cyan / 50 magenta",
    maxGates: 1,
    allowedGates: ["H"],
    order: 1,
    aliases: ["1", "lv1", "level1", "mix"],
  },
  {
    id: "2",
    title: "Level 2 - Blendy Blend",
    description: "Start from cyan |00> and create an equal mix of cyan, magenta, yellow, and black.",
    hint: "Create a blend in both qubits.",
    start: "cyan",
    target: "25 cyan / 25 magenta / 25 yellow / 25 black",
    maxGates: 2,
    allowedGates: ["H"],
    order: 2,
    aliases: ["2", "lv2", "level2", "blend"],
  },
  {
    id: "3",
    title: "Level 3 - Forbidden Colours",
    description: "Start from cyan |00> and create a 50-50 cyan/black mix with no magenta and no yellow.",
    hint: "Entangle two qubits using the new tool.",
    start: "cyan",
    target: "50 cyan / 50 black",
    maxGates: 2,
    allowedGates: ["H", "CNOT"],
    order: 3,
    aliases: ["3", "lv3", "level3", "forbidden"],
  },
  {
    id: "4",
    title: "Level 4 - Weighted Purple",
    description: "Start from cyan |00> and make the blend lean toward cyan: about 75% cyan and 25% magenta.",
    hint: "Not every quantum blend is a perfect 50-50 split.",
    start: "cyan",
    target: "75 cyan / 25 magenta",
    targetTolerance: 0.05,
    maxGates: 1,
    allowedGates: ["RY"],
    order: 4,
    aliases: ["4", "lv4", "level4", "weighted"],
  },
  {
    id: "5",
    title: "Level 5 - Swap Around",
    description: "Start from cyan |00> and create a mix with 75% cyan and 25% yellow.",
    hint: "Try building the blend on one qubit first, then move it into place.",
    start: "cyan",
    target: "75 cyan / 25 yellow",
    maxGates: 2,
    allowedGates: ["RY", "SWAP"],
    order: 5,
    aliases: ["5", "lv5", "level5", "swap"],
  },
  {
    id: "playground",
    title: "Playground",
    description: "Starting from colour black, build any gate combo you like, and see the measured colours.",
    start: "black",
    target: null,
    maxGates: 10,
    allowedGates: ["I", "X", "Y", "Z", "H", "RX", "RY", "RZ", "CNOT", "SWAP", "CPHASE"],
    order: 6,
    aliases: ["p", "playground"],
  },
];

export const levels: Level[] = definitions
  .map((definition) => {
    const start = parseColourBasisState(definition.start ?? "black");
    const target = definition.target ? parseColourState(definition.target) : null;
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      hint: definition.hint ?? "",
      start: start.key,
      startState: start.state,
      startLabel: start.label,
      target: definition.target,
      targetState: target?.state ?? null,
      targetLabel: target?.label ?? null,
      targetTolerance: definition.targetTolerance ?? 1e-9,
      maxGates: definition.maxGates,
      allowedGates: definition.allowedGates,
      aliases: definition.aliases,
      order: definition.order,
    };
  })
  .sort((a, b) => a.order - b.order);
