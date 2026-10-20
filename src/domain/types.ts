export type NodeKind = 'character' | 'place' | 'event';

export type Visibility = 'hidden' | 'censored' | 'revealed';

export interface Position {
  x: number;
  y: number;
}

export interface StoryNode {
  id: string;
  kind: NodeKind;
  title: string;
  position: Position;
  homologueKey: string;
  intro: string;
  revealedAtStart?: boolean;
  central?: { required: boolean };
  finale?: boolean;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
}

export type QuestionAccess = 'adjacent' | 'enquete';

export interface Question {
  id: string;
  targetNodeId: string;
  access: QuestionAccess;
  requiresRevealed: string[];
  alsoRevealed?: string[];
  context: string;
  prompt: string;
  answers: string[];
  wrongFeedback: string;
}

export type UniverseKind = 'tale' | 'meta';

export interface UniverseData {
  id: string;
  name: string;
  kind: UniverseKind;
  tagline: string;
  nodes: StoryNode[];
  relations: Relation[];
  questions: Question[];
  ending?: { title: string; body: string };
}

export interface Universe extends UniverseData {
  nodeById: Map<string, StoryNode>;
  relationIdsByNode: Map<string, string[]>;
}

export type JournalEntry =
  | { type: 'reveal'; universeId: string; nodeId: string }
  | { type: 'visit'; universeId: string }
  | { type: 'ending'; universeId: string };

export interface GameState {
  currentUniverseId: string;
  revealed: Record<string, string[]>;
  answeredQuestions: string[];
  visited: string[];
  unseen: string[];
  journal: JournalEntry[];
}
