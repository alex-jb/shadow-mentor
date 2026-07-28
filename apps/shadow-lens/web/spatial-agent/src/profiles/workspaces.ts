// apps/shadow-lens/web/spatial-agent/src/profiles/workspaces.ts
// §4 — Profile-specific presentation config. One generic shell + three adapters (no three apps).
// Pure data + selectors over the REAL scene graph (which object is the "slate", which modes are
// available, the default mode). No invented content.
import type { SceneGraph, SceneObject } from "../app/types.ts";

export interface ProfileWorkspace {
  id: string;
  title: string;
  defaultMode: string;
  modes: string[];
  slateTypes: string[];          // object types shown on the left slate
  resultCardType: string;        // what the right card summarizes
  slateObjects(scene: SceneGraph): SceneObject[];
}

function bySlate(scene: SceneGraph, types: string[]): SceneObject[] {
  return (scene?.objects ?? []).filter((o) => types.includes(o.type));
}

export const BankingWorkspace: ProfileWorkspace = {
  id: "banking-v1", title: "Banking Decision", defaultMode: "document",
  modes: ["document", "source", "risk", "review", "audit"],
  slateTypes: ["capture", "source"], resultCardType: "claim",
  slateObjects(s) { return bySlate(s, this.slateTypes); },
};

export const DataScienceWorkspace: ProfileWorkspace = {
  id: "data-science-v1", title: "Data Science Experiment", defaultMode: "experiment",
  modes: ["document", "source", "experiment", "review", "audit"],
  slateTypes: ["tool", "metric"], resultCardType: "model",
  slateObjects(s) { return bySlate(s, this.slateTypes); },
};

export const CodingWorkspace: ProfileWorkspace = {
  id: "coding-agent-v1", title: "Coding Agent Replay", defaultMode: "code",
  modes: ["document", "source", "code", "review", "audit"],
  slateTypes: ["tool", "test"], resultCardType: "commit",
  slateObjects(s) { return bySlate(s, this.slateTypes); },
};

export const WORKSPACES: Record<string, ProfileWorkspace> = {
  "banking-v1": BankingWorkspace,
  "data-science-v1": DataScienceWorkspace,
  "coding-agent-v1": CodingWorkspace,
};

export function workspaceFor(profileId: string): ProfileWorkspace {
  return WORKSPACES[profileId] ?? DataScienceWorkspace;
}
