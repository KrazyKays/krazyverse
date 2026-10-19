export type NodeKind = 'character' | 'place' | 'event';

export type Visibility = 'hidden' | 'censored' | 'revealed';

export interface Position {
  x: number;
  y: number;
}

export interface StorySection {
  id: string;
  title: string;
  body: string;
  unlockedByQuestionId?: string;
}

export interface StoryNode {
  id: string;
  kind: NodeKind;
  title: string;
  position: Position;
  homologueKey: string;
  intro: string;
  sections: StorySection[];
  revealedAtStart?: boolean;
  startVisible?: boolean;
  central?: { required: boolean };
  finale?: boolean;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
}

export interface Echo {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export type QuestionAccess = 'adjacent' | 'enquete';

export interface Question {
  id: string;
  targetNodeId: string;
  access: QuestionAccess;
  requiresRevealed: string[];
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
  echoes: Echo[];
  questions: Question[];
  ending?: { title: string; body: string };
}

export interface Universe extends UniverseData {
  nodeById: Map<string, StoryNode>;
  relationIdsByNode: Map<string, string[]>;
  echoIdsByNode: Map<string, string[]>;
}

export type JournalEntry =
  | { type: 'reveal'; universeId: string; nodeId: string }
  | { type: 'echo'; universeId: string; nodeId: string; sourceNodeId: string }
  | { type: 'section'; universeId: string; nodeId: string; sectionId: string }
  | { type: 'visit'; universeId: string }
  | { type: 'ending'; universeId: string };

export interface GameState {
  currentUniverseId: string;
  revealed: Record<string, string[]>;
  unlockedSections: string[];
  answeredQuestions: string[];
  visited: string[];
  unseen: string[];
  journal: JournalEntry[];
}
