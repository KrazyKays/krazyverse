import { describe, expect, it } from 'vitest';
import {
  answerQuestion,
  centralRemaining,
  createInitialState,
  isEnded,
  isRevealed,
  visitUniverse,
} from '../domain/progression';
import type { UniverseMap } from '../domain/progression';
import type { GameState, Universe } from '../domain/types';
import { buildUniverse } from '../domain/universe';
import { computeVisibility, visibilityFor, visibleRelationIds } from '../domain/visibility';
import { node, question } from './fixtures/builders';
import { loadGame, sanitizeState, saveGame, SAVE_KEY } from '../storage/save';

const BOIS = 'universe1';
const FORGES = 'tale-forges-de-verre';
const META = 'meta-enquete';

const fixtureUniverses = [
  buildUniverse({
    id: BOIS,
    name: 'Bois',
    kind: 'tale',
    tagline: '',
    nodes: [node('a-centre', { revealedAtStart: true }), node('a-sentier'), node('a-gorm', { kind: 'character' }), node('a-pierres')],
    relations: [
      { id: 'r-centre-sentier', from: 'a-centre', to: 'a-sentier' },
      { id: 'r-sentier-gorm', from: 'a-sentier', to: 'a-gorm' },
      { id: 'r-centre-pierres', from: 'a-centre', to: 'a-pierres' },
    ],
    questions: [
      question('qa-sentier', 'a-sentier', { answers: ['le chemin change de longueur'], alsoRevealed: ['b-foret'] }),
      question('qa-pierres', 'a-pierres', { access: 'enquete', answers: ['les pierres'], alsoRevealed: ['b-foret'] }),
    ],
  }),
  buildUniverse({
    id: FORGES,
    name: 'Forges',
    kind: 'tale',
    tagline: '',
    nodes: [node('b-centre', { revealedAtStart: true }), node('b-foret')],
    relations: [{ id: 'r-centre-foret', from: 'b-centre', to: 'b-foret' }],
    questions: [question('qb-foret', 'b-foret', { answers: ['la forêt'] })],
  }),
  buildUniverse({
    id: META,
    name: 'Multivers',
    kind: 'meta',
    tagline: '',
    nodes: [
      node('m-origine', { central: { required: true } }),
      node('m-finale', { central: { required: true }, finale: true }),
    ],
    relations: [],
    questions: [
      question('qm-origine', 'm-origine', { access: 'enquete', answers: ['origine'] }),
      question('qm-finale', 'm-finale', { access: 'enquete', answers: ['fin'] }),
    ],
  }),
];

const fixtures: UniverseMap = Object.fromEntries(fixtureUniverses.map((universe) => [universe.id, universe]));

function universeOf(universeId: string): Universe {
  const universe = fixtures[universeId];
  if (!universe) throw new Error(`Univers inconnu : ${universeId}`);
  return universe;
}

function freshState(): GameState {
  return createInitialState(fixtures);
}

function answer(state: GameState, universeId: string, questionId: string, text: string): GameState {
  return answerQuestion(state, fixtures, universeId, questionId, text).state;
}

function visibilityOf(state: GameState, universeId: string) {
  return visibilityFor(state, universeOf(universeId));
}

describe('visibilité des nœuds', () => {
  it('rend visible un nœud censuré directement connecté à un nœud révélé', () => {
    const visibility = visibilityOf(freshState(), BOIS);
    expect(visibility.get('a-centre')).toBe('revealed');
    expect(visibility.get('a-sentier')).toBe('censored');
  });

  it('garde caché un nœud situé derrière un nœud non révélé', () => {
    expect(visibilityOf(freshState(), BOIS).get('a-gorm')).toBe('hidden');
  });

  it("ne censure pas une cible d'enquête si elle n'est pas liée à un nœud révélé", () => {
    expect(visibilityOf(freshState(), META).get('m-origine')).toBe('hidden');
  });

  it("ne censure pas la cible d'une question accessible par adjacence si elle n'est pas liée à un nœud révélé", () => {
    const universe = buildUniverse({
      id: 'x',
      name: 'x',
      kind: 'tale',
      tagline: '',
      nodes: [node('x-centre', { revealedAtStart: true }), node('x-loin')],
      relations: [],
      questions: [question('qx-loin', 'x-loin')],
    });
    expect(computeVisibility(universe, new Set(['x-centre'])).get('x-loin')).toBe('hidden');
  });

  it("ne révèle pas automatiquement les voisins d'un nœud révélé", () => {
    const state = answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur');
    expect(isRevealed(state, BOIS, 'a-sentier')).toBe(true);
    expect(isRevealed(state, BOIS, 'a-gorm')).toBe(false);
    expect(visibilityOf(state, BOIS).get('a-gorm')).toBe('censored');
  });

  it('met à jour les relations visibles après une révélation', () => {
    const universe = universeOf(BOIS);
    const before = visibleRelationIds(universe, visibilityOf(freshState(), BOIS));
    const after = visibleRelationIds(
      universe,
      visibilityOf(answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur'), BOIS),
    );
    expect(before.has('r-sentier-gorm')).toBe(false);
    expect(after.has('r-sentier-gorm')).toBe(true);
  });
});

describe('questions', () => {
  it('ne modifie pas la progression après une mauvaise réponse', () => {
    const state = freshState();
    const result = answerQuestion(state, fixtures, BOIS, 'qa-sentier', 'les fougères poussent');
    expect(result.correct).toBe(false);
    expect(result.state).toBe(state);
  });

  it('révèle le nœud ciblé après une bonne réponse', () => {
    const result = answerQuestion(freshState(), fixtures, BOIS, 'qa-sentier', 'Le chemin change de longueur');
    expect(result.correct).toBe(true);
    expect(isRevealed(result.state, BOIS, 'a-sentier')).toBe(true);
  });
});

describe('révélations croisées', () => {
  it('révèle les nœuds choisis par la question dans un autre univers', () => {
    const state = answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur');
    expect(isRevealed(state, FORGES, 'b-foret')).toBe(true);
    expect(isRevealed(state, BOIS, 'a-gorm')).toBe(false);
  });

  it("signale l'univers touché sans changer l'univers affiché", () => {
    const state = answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur');
    expect(state.unseen).toEqual([FORGES]);
    expect(state.currentUniverseId).toBe(BOIS);
  });

  it('ne duplique pas le signalement lorsque le nœud est déjà révélé', () => {
    const first = answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur');
    const second = answer(first, BOIS, 'qa-pierres', 'les pierres');
    expect(isRevealed(second, BOIS, 'a-pierres')).toBe(true);
    expect(second.unseen).toEqual([FORGES]);
  });

  it("retire le signalement lorsque l'univers est consulté", () => {
    const state = answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur');
    const visited = visitUniverse(state, FORGES);
    expect(visited.unseen).not.toContain(FORGES);
    expect(visited.currentUniverseId).toBe(FORGES);
  });

  it('ne révèle que les nœuds de départ tant qu’aucune question n’est résolue', () => {
    expect(isRevealed(freshState(), FORGES, 'b-foret')).toBe(false);
  });
});

describe('question centrale', () => {
  it('compte les nœuds obligatoires non révélés', () => {
    const meta = universeOf(META);
    expect(centralRemaining(freshState(), meta)).toBe(2);
    expect(centralRemaining(answer(freshState(), META, 'qm-origine', 'origine'), meta)).toBe(1);
  });

  it('termine la partie lorsque le nœud final est révélé', () => {
    const meta = universeOf(META);
    expect(isEnded(freshState(), meta)).toBe(false);
    expect(isEnded(answer(freshState(), META, 'qm-finale', 'fin'), meta)).toBe(true);
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
    const state = answer(freshState(), BOIS, 'qa-sentier', 'le chemin change de longueur');
    expect(saveGame(store, state)).toBe(true);
    expect(loadGame(store, fixtures)).toEqual(state);
  });

  it('ignore une sauvegarde invalide sans planter', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, '{pas du json');
    expect(loadGame(store, fixtures)).toBeNull();

    store.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: { revealed: 'n\'importe quoi' } }));
    expect(loadGame(store, fixtures)).toBeNull();

    store.setItem(SAVE_KEY, JSON.stringify({ version: 99, state: {} }));
    expect(loadGame(store, fixtures)).toBeNull();
  });

  it("retire les identifiants inconnus d'une sauvegarde", () => {
    const raw = {
      currentUniverseId: 'univers-fantome',
      revealed: { [BOIS]: ['a-centre', 'nœud-fantome'] },
      answeredQuestions: ['question-fantome'],
      visited: ['univers-fantome'],
      unseen: [FORGES, 'univers-fantome'],
      journal: [{ type: 'reveal', universeId: BOIS, nodeId: 'nœud-fantome' }],
    };
    const state = sanitizeState(raw, fixtures);
    expect(state?.currentUniverseId).toBe(BOIS);
    expect(state?.revealed[BOIS]).toEqual(['a-centre']);
    expect(state?.answeredQuestions).toEqual([]);
    expect(state?.unseen).toEqual([FORGES]);
    expect(state?.journal).toEqual([]);
  });
});
