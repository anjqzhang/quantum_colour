import { parseColourBasisState, parseColourState } from "./game/colour";
import { canonicalGateName } from "./game/parser";
import type { GateFamily, Level } from "./game/types";
import lv1 from "../levels/lv1.json";
import lv2 from "../levels/lv2.json";
import lv3 from "../levels/lv3.json";
import lv4 from "../levels/lv4.json";
import lv5 from "../levels/lv5.json";
import playground from "../levels/playground.json";

type LevelDefinition = {
  id: string;
  title: string;
  description: string;
  hint?: string;
  start?: string;
  target: string | null;
  maxGates: number;
  allowedGates: string[];
  order: number;
  aliases: string[];
  targetTolerance?: number;
};

const definitions: LevelDefinition[] = [lv1, lv2, lv3, lv4, lv5, playground];

export const levels: Level[] = definitions
  .map((definition) => {
    const start = parseColourBasisState(definition.start ?? "black");
    const target = definition.target ? parseColourState(definition.target) : null;
    const allowedGates: GateFamily[] = definition.allowedGates.map(canonicalGateName);
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
      allowedGates,
      aliases: definition.aliases,
      order: definition.order,
    };
  })
  .sort((a, b) => a.order - b.order);
