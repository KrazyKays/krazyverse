import { isAnswerAccepted } from './answers';
import { visibilityFor } from './visibility';
import type { GameState, NodeRef, Question, StoryNode, Universe } from './types';

export type UniverseMap = Record<string, Universe>;

export const START_UNIVERSE_ID = 'universe1';

export function createInitialState(universes: UniverseMap): GameState {
  let state: GameState = {
    currentUniverseId: START_UNIVERSE_ID,
    revealed: {},
    answeredQuestions: [],
    visited: [START_UNIVERSE_ID],
    unseen: [],
    journal: [{ type: 'visit', universeId: START_UNIVERSE_ID }],
  };

  for (const universe of Object.values(universes)) {
    for (const node of universe.nodes) {
      if (node.revealedAtStart) {
        state = revealNode(state, universes, universe.id, node.id);
      }
    }
  }

  return state;
}

export function isRevealed(state: GameState, universeId: string, nodeId: string): boolean {
  return state.revealed[universeId]?.includes(nodeId) ?? false;
}

export function isRevealedAnywhere(state: GameState, nodeId: string): boolean {
  return Object.values(state.revealed).some((ids) => ids.includes(nodeId));
}

export function findUniverseOfNode(universes: UniverseMap, nodeId: string): Universe | undefined {
  return Object.values(universes).find((universe) => universe.nodeById.has(nodeId));
}

export function revealNode(state: GameState, universes: UniverseMap, universeId: string, nodeId: string): GameState {
  const universe = universes[universeId];
  const node = universe?.nodeById.get(nodeId);
  if (!universe || !node || isRevealed(state, universeId, nodeId)) {
    return state;
  }

  let next: GameState = {
    ...state,
    revealed: {
      ...state.revealed,
      [universeId]: [...(state.revealed[universeId] ?? []), nodeId],
    },
    journal: [...state.journal, { type: 'reveal', universeId, nodeId }],
  };

  if (node.finale && !next.journal.some((entry) => entry.type === 'ending')) {
    next = { ...next, journal: [...next.journal, { type: 'ending', universeId }] };
  }

  return next;
}

function markUnseen(state: GameState, universeId: string): GameState {
  if (universeId === state.currentUniverseId || state.unseen.includes(universeId)) return state;
  return { ...state, unseen: [...state.unseen, universeId] };
}

export function isQuestionAvailable(state: GameState, universe: Universe, question: Question): boolean {
  if (state.answeredQuestions.includes(question.id)) return false;
  if (isRevealed(state, universe.id, question.targetNodeId)) return false;
  if (!universe.nodeById.has(question.targetNodeId)) return false;
  if (!question.requiresRevealed.every((nodeId) => isRevealedAnywhere(state, nodeId))) return false;

  if (question.access === 'enquete') return true;

  const visibility = visibilityFor(state, universe);
  return visibility.get(question.targetNodeId) === 'censored';
}

export function availableQuestions(state: GameState, universe: Universe): Question[] {
  return universe.questions.filter((question) => isQuestionAvailable(state, universe, question));
}

export interface AnswerResult {
  state: GameState;
  correct: boolean;
  /** Nœuds révélés par la réponse, la cible en premier. */
  discoveries: NodeRef[];
}

export function answerQuestion(
  state: GameState,
  universes: UniverseMap,
  universeId: string,
  questionId: string,
  answer: string,
): AnswerResult {
  const universe = universes[universeId];
  const question = universe?.questions.find((candidate) => candidate.id === questionId);
  if (!universe || !question || !isQuestionAvailable(state, universe, question)) {
    return { state, correct: false, discoveries: [] };
  }
  if (!isAnswerAccepted(answer, question.answers)) {
    return { state, correct: false, discoveries: [] };
  }

  let next: GameState = {
    ...state,
    answeredQuestions: [...state.answeredQuestions, question.id],
  };

  next = revealNode(next, universes, universeId, question.targetNodeId);
  for (const nodeId of question.alsoRevealed ?? []) {
    const target = findUniverseOfNode(universes, nodeId);
    if (!target || isRevealed(next, target.id, nodeId)) continue;
    next = markUnseen(revealNode(next, universes, target.id, nodeId), target.id);
  }

  const discoveries = next.journal
    .slice(state.journal.length)
    .flatMap((entry) => (entry.type === 'reveal' ? [{ universeId: entry.universeId, nodeId: entry.nodeId }] : []));

  return { state: next, correct: true, discoveries };
}

export function visitUniverse(state: GameState, universeId: string): GameState {
  const isFirstVisit = !state.visited.includes(universeId);
  return {
    ...state,
    currentUniverseId: universeId,
    visited: isFirstVisit ? [...state.visited, universeId] : state.visited,
    unseen: state.unseen.filter((id) => id !== universeId),
    journal: isFirstVisit ? [...state.journal, { type: 'visit', universeId }] : state.journal,
  };
}

export function centralRemaining(state: GameState, central: Universe): number {
  return central.nodes.filter(
    (node) => node.central?.required && !isRevealed(state, central.id, node.id),
  ).length;
}

export function isEnded(state: GameState, central: Universe): boolean {
  return central.nodes.some((node) => node.finale && isRevealed(state, central.id, node.id));
}

/** Nœuds que la question exige d'avoir révélés et qui ne le sont encore nulle part. */
export function missingRequirements(state: GameState, universes: UniverseMap, question: Question): NodeRef[] {
  return question.requiresRevealed
    .filter((nodeId) => !isRevealedAnywhere(state, nodeId))
    .flatMap((nodeId) => {
      const universe = findUniverseOfNode(universes, nodeId);
      return universe ? [{ universeId: universe.id, nodeId }] : [];
    });
}

export interface OpenQuestion {
  universe: Universe;
  question: Question;
}

export function openQuestions(state: GameState, ordered: Universe[]): OpenQuestion[] {
  return ordered.flatMap((universe) => availableQuestions(state, universe).map((question) => ({ universe, question })));
}

export function universeProgress(state: GameState, universe: Universe): { revealed: number; total: number } {
  return { revealed: state.revealed[universe.id]?.length ?? 0, total: universe.nodes.length };
}

/** Versions du même nœud dans les autres univers, reliées par leur homologueKey. */
export function homologuesOf(ordered: Universe[], universeId: string, node: StoryNode): { universe: Universe; node: StoryNode }[] {
  if (node.homologueKey === '') return [];
  return ordered.flatMap((universe) => {
    if (universe.id === universeId) return [];
    const match = universe.nodes.find((candidate) => candidate.homologueKey === node.homologueKey);
    return match ? [{ universe, node: match }] : [];
  });
}
