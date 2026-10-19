import { describe, expect, it } from 'vitest';
import { universes, META_ID, BOIS_ID, FORGES_ID } from '../data';
import {
  answerQuestion,
  centralRemaining,
  createInitialState,
  isEnded,
  isRevealed,
  revealNode,
  visitUniverse,
} from '../domain/progression';
import type { GameState } from '../domain/types';
import { computeVisibility, visibleRelationIds } from '../domain/visibility';
import { loadGame, sanitizeState, saveGame, SAVE_KEY } from '../storage/save';

function freshState(): GameState {
  return createInitialState(universes);
}

function answerCorrect(state: GameState, questionId: string): GameState {
  const universe = Object.values(universes).find((candidate) =>
    candidate.questions.some((question) => question.id === questionId),
  );
  const question = universe?.questions.find((candidate) => candidate.id === questionId);
  if (!universe || !question) throw new Error(`Question inconnue : ${questionId}`);
  return answerQuestion(state, universes, universe.id, questionId, question.answers[0] ?? '').state;
}

function visibilityOf(state: GameState, universeId: string) {
  const universe = universes[universeId];
  if (!universe) throw new Error(`Univers inconnu : ${universeId}`);
  return computeVisibility(universe, new Set(state.revealed[universeId] ?? []));
}

describe('visibilité des nœuds', () => {
  it('rend visible un nœud censuré directement connecté à un nœud révélé', () => {
    const visibility = visibilityOf(freshState(), BOIS_ID);
    expect(visibility.get('u1-aniel')).toBe('revealed');
    expect(visibility.get('u1-sentier')).toBe('censored');
  });

  it('garde caché un nœud situé derrière un nœud non révélé', () => {
    const visibility = visibilityOf(freshState(), BOIS_ID);
    expect(visibility.get('u1-gorm')).toBe('hidden');
    expect(visibility.get('u1-chaumiere')).toBe('hidden');
  });

  it('ne révèle pas automatiquement les voisins d\'un nœud révélé', () => {
    const state = answerCorrect(freshState(), 'q-u1-sentier');
    expect(isRevealed(state, BOIS_ID, 'u1-sentier')).toBe(true);
    expect(isRevealed(state, BOIS_ID, 'u1-gorm')).toBe(false);
    expect(visibilityOf(state, BOIS_ID).get('u1-gorm')).toBe('censored');
  });

  it('met à jour les relations visibles après une révélation', () => {
    const before = freshState();
    const after = answerCorrect(before, 'q-u1-sentier');
    const relationBefore = visibleRelationIds(boisUniverse(), visibilityOf(before, BOIS_ID));
    const relationAfter = visibleRelationIds(boisUniverse(), visibilityOf(after, BOIS_ID));
    expect(relationBefore).not.toContain('r1-sentier-gorm');
    expect(relationAfter).toContain('r1-sentier-gorm');
  });

  it('n\'expose pas de relation vers un nœud caché', () => {
    const visibility = visibilityOf(freshState(), BOIS_ID);
    const relations = visibleRelationIds(boisUniverse(), visibility);
    expect(relations).not.toContain('r1-sentier-gorm');
  });
});

describe('questions', () => {
  it('ne modifie pas la progression après une mauvaise réponse', () => {
    const state = freshState();
    const result = answerQuestion(state, universes, BOIS_ID, 'q-u1-sentier', 'les fougères poussent');
    expect(result.correct).toBe(false);
    expect(result.state).toBe(state);
  });

  it('révèle immédiatement le nœud attendu après une bonne réponse', () => {
    const result = answerQuestion(freshState(), universes, BOIS_ID, 'q-u1-sentier', 'Le chemin change de longueur');
    expect(result.correct).toBe(true);
    expect(isRevealed(result.state, BOIS_ID, 'u1-sentier')).toBe(true);
  });
});

describe('échos entre univers', () => {
  it('déclenche un indicateur sur l\'univers cible', () => {
    const state = freshState();
    expect(isRevealed(state, FORGES_ID, 'u2-aniel')).toBe(true);
    expect(state.unseen).toContain(FORGES_ID);
  });

  it('ne change pas automatiquement l\'univers affiché', () => {
    expect(freshState().currentUniverseId).toBe(BOIS_ID);
  });

  it('retire l\'indicateur lorsque l\'univers cible est consulté', () => {
    const visited = visitUniverse(freshState(), FORGES_ID);
    expect(visited.unseen).not.toContain(FORGES_ID);
    expect(visited.currentUniverseId).toBe(FORGES_ID);
  });

  it('ne révèle que les nœuds explicitement configurés', () => {
    const state = freshState();
    expect(isRevealed(state, FORGES_ID, 'u2-gorm')).toBe(false);
    expect(isRevealed(state, FORGES_ID, 'u2-sentier')).toBe(false);
  });

  it('ne révèle pas les voisins d\'un nœud révélé par écho', () => {
    const state = revealNode(freshState(), universes, FORGES_ID, 'u2-chaumiere');
    expect(isRevealed(state, FORGES_ID, 'u2-chaumiere')).toBe(true);
    expect(isRevealed(state, FORGES_ID, 'u2-ysolde')).toBe(false);
  });
});

describe('données', () => {
  it('référence uniquement des identifiants existants', () => {
    for (const universe of Object.values(universes)) {
      for (const relation of universe.relations) {
        expect(universe.nodeById.has(relation.from)).toBe(true);
        expect(universe.nodeById.has(relation.to)).toBe(true);
      }
      for (const echo of universe.echoes) {
        expect(universe.nodeById.has(echo.sourceNodeId)).toBe(true);
        const targetExists = Object.values(universes).some((other) => other.nodeById.has(echo.targetNodeId));
        expect(targetExists).toBe(true);
      }
      for (const question of universe.questions) {
        expect(universe.nodeById.has(question.targetNodeId)).toBe(true);
        expect(question.answers.length).toBeGreaterThan(0);
      }
    }
  });

  it('démarre l\'univers méta avec un seul nœud censuré', () => {
    const meta = universes[META_ID];
    if (!meta) throw new Error('Univers méta manquant');
    const censored = [...visibilityOf(freshState(), META_ID).values()].filter((value) => value === 'censored');
    expect(censored).toHaveLength(1);
    expect(meta.nodes.some((node) => node.startVisible)).toBe(true);
  });
});

describe('enquête centrale', () => {
  it('calcule le compteur à partir des nœuds obligatoires non révélés', () => {
    const meta = universes[META_ID];
    if (!meta) throw new Error('Univers méta manquant');
    const state = freshState();
    expect(centralRemaining(state, meta)).toBe(4);
    const next = answerCorrect(state, 'q-meta-origine');
    expect(centralRemaining(next, meta)).toBe(3);
  });

  it('affiche la conclusion lorsque les conditions de victoire sont remplies', () => {
    const meta = universes[META_ID];
    if (!meta) throw new Error('Univers méta manquant');

    let state = freshState();
    for (const questionId of [
      'q-u1-sentier',
      'q-u1-chaumiere',
      'q-u1-ysolde',
      'q-u1-nuit',
      'q-u1-gorm',
      'q-u1-serment',
      'q-u2-sentier',
      'q-u2-chaumiere',
      'q-u2-ysolde',
      'q-u2-nuit',
      'q-meta-origine',
      'q-meta-anomalie-1',
      'q-meta-anomalie-2',
      'q-meta-finale',
    ]) {
      state = answerCorrect(state, questionId);
    }

    expect(isEnded(state, meta)).toBe(true);
    expect(centralRemaining(state, meta)).toBe(0);
  });
});

describe('sauvegarde', () => {
  function memoryStore() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  }

  it('restaure une sauvegarde après rechargement', () => {
    const store = memoryStore();
    const state = answerCorrect(freshState(), 'q-u1-sentier');
    expect(saveGame(store, state)).toBe(true);
    const restored = loadGame(store, universes);
    expect(restored).toEqual(state);
  });

  it('ignore une sauvegarde invalide sans planter', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, '{pas du json');
    expect(loadGame(store, universes)).toBeNull();

    store.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: { revealed: 'n\'importe quoi' } }));
    expect(loadGame(store, universes)).toBeNull();

    store.setItem(SAVE_KEY, JSON.stringify({ version: 99, state: {} }));
    expect(loadGame(store, universes)).toBeNull();
  });

  it('retire les identifiants inconnus d\'une sauvegarde', () => {
    const raw = {
      currentUniverseId: 'univers-fantome',
      revealed: { [BOIS_ID]: ['u1-aniel', 'nœud-fantome'] },
      unlockedSections: ['section-fantome'],
      answeredQuestions: ['question-fantome'],
      visited: ['univers-fantome'],
      unseen: [FORGES_ID, 'univers-fantome'],
      journal: [{ type: 'reveal', universeId: BOIS_ID, nodeId: 'nœud-fantome' }],
    };
    const state = sanitizeState(raw, universes);
    expect(state?.currentUniverseId).toBe(BOIS_ID);
    expect(state?.revealed[BOIS_ID]).toEqual(['u1-aniel']);
    expect(state?.unlockedSections).toEqual([]);
    expect(state?.answeredQuestions).toEqual([]);
    expect(state?.unseen).toEqual([FORGES_ID]);
    expect(state?.journal).toEqual([]);
  });
});

function boisUniverse() {
  const universe = universes[BOIS_ID];
  if (!universe) throw new Error('Univers manquant');
  return universe;
}
