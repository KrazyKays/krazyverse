import { computeVisibility } from './visibility';
import type { GameState, JournalEntry, Question, Universe } from './types';

export type UniverseMap = Record<string, Universe>;

export const START_UNIVERSE_ID = 'tale-bois-de-brume';

export function createInitialState(universes: UniverseMap): GameState {
  let state: GameState = {
    currentUniverseId: START_UNIVERSE_ID,
    revealed: {},
    unlockedSections: [],
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

function isRevealedAnywhere(state: GameState, nodeId: string): boolean {
  return Object.values(state.revealed).some((ids) => ids.includes(nodeId));
}

function findUniverseOfNode(universes: UniverseMap, nodeId: string): Universe | undefined {
  return Object.values(universes).find((universe) => universe.nodeById.has(nodeId));
}

export function revealNode(
  state: GameState,
  universes: UniverseMap,
  universeId: string,
  nodeId: string,
  sourceNodeId?: string,
): GameState {
  const universe = universes[universeId];
  const node = universe?.nodeById.get(nodeId);
  if (!universe || !node || isRevealed(state, universeId, nodeId)) {
    return state;
  }

  const journalEntry: JournalEntry = sourceNodeId
    ? { type: 'echo', universeId, nodeId, sourceNodeId }
    : { type: 'reveal', universeId, nodeId };

  let next: GameState = {
    ...state,
    revealed: {
      ...state.revealed,
      [universeId]: [...(state.revealed[universeId] ?? []), nodeId],
    },
    journal: [...state.journal, journalEntry],
  };

  if (node.finale && !next.journal.some((entry) => entry.type === 'ending')) {
    next = { ...next, journal: [...next.journal, { type: 'ending', universeId }] };
  }

  for (const echoId of universe.echoIdsByNode.get(nodeId) ?? []) {
    const echo = universe.echoes.find((candidate) => candidate.id === echoId);
    if (!echo) continue;
    const targetUniverse = findUniverseOfNode(universes, echo.targetNodeId);
    if (!targetUniverse || isRevealed(next, targetUniverse.id, echo.targetNodeId)) continue;

    next = revealNode(next, universes, targetUniverse.id, echo.targetNodeId, nodeId);
    if (targetUniverse.id !== next.currentUniverseId && !next.unseen.includes(targetUniverse.id)) {
      next = { ...next, unseen: [...next.unseen, targetUniverse.id] };
    }
  }

  return next;
}

export function isQuestionAvailable(state: GameState, universe: Universe, question: Question): boolean {
  if (state.answeredQuestions.includes(question.id)) return false;
  if (isRevealed(state, universe.id, question.targetNodeId)) return false;
  if (!universe.nodeById.has(question.targetNodeId)) return false;
  if (!question.requiresRevealed.every((nodeId) => isRevealedAnywhere(state, nodeId))) return false;

  if (question.access === 'enquete') return true;

  const visibility = computeVisibility(universe, new Set(state.revealed[universe.id] ?? []));
  return visibility.get(question.targetNodeId) === 'censored';
}

export function availableQuestions(state: GameState, universe: Universe): Question[] {
  return universe.questions.filter((question) => isQuestionAvailable(state, universe, question));
}

export function answerQuestion(
  state: GameState,
  universes: UniverseMap,
  universeId: string,
  questionId: string,
  choiceId: string,
): { state: GameState; correct: boolean } {
  const universe = universes[universeId];
  const question = universe?.questions.find((candidate) => candidate.id === questionId);
  if (!universe || !question || !isQuestionAvailable(state, universe, question)) {
    return { state, correct: false };
  }
  if (choiceId !== question.correctChoiceId) {
    return { state, correct: false };
  }

  let next: GameState = {
    ...state,
    answeredQuestions: [...state.answeredQuestions, question.id],
  };

  for (const node of universe.nodes) {
    for (const section of node.sections) {
      if (section.unlockedByQuestionId !== question.id) continue;
      if (next.unlockedSections.includes(section.id)) continue;
      next = {
        ...next,
        unlockedSections: [...next.unlockedSections, section.id],
        journal: [...next.journal, { type: 'section', universeId, nodeId: node.id, sectionId: section.id }],
      };
    }
  }

  next = revealNode(next, universes, universeId, question.targetNodeId);
  return { state: next, correct: true };
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
