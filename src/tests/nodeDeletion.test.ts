import { describe, expect, it } from 'vitest';
import { buildUniverse } from '../domain/universe';
import type { Universe, UniverseData } from '../domain/types';
import type { ContentPath, ScopedEdit } from '../setup/api';
import { planNodeDeletion } from '../setup/nodeDeletion';
import { node, question } from './fixtures/builders';
import { fixtureUniverses } from './fixtures/universes';

type Container = Record<string | number, unknown>;
type DataSet = Record<string, UniverseData>;

function snapshotOf(list: Universe[]): DataSet {
  return Object.fromEntries(
    list.map(({ id, name, kind, tagline, nodes, relations, questions, ending }) => [
      id,
      structuredClone({ id, name, kind, tagline, nodes, relations, questions, ending }),
    ]),
  );
}

function childKey(container: unknown, segment: ContentPath[number]): string | number {
  if (typeof segment !== 'object') return segment;
  const index = (container as unknown[]).findIndex((item) => (item as { id?: string }).id === segment.id);
  if (index < 0) throw new Error(`Élément introuvable : ${segment.id}`);
  return index;
}

function applyEdit(data: DataSet, edit: ScopedEdit): void {
  let container: unknown = data[edit.universeId];
  const path = edit.path;
  for (const segment of path.slice(0, -1)) {
    container = (container as Container)[childKey(container, segment)];
  }
  const last = path[path.length - 1] as ContentPath[number];
  const key = childKey(container, last);

  if (edit.op === 'push') {
    ((container as Container)[key] as unknown[]).push(edit.value);
  } else if (edit.op === 'set') {
    (container as Container)[key] = edit.value;
  } else if (Array.isArray(container)) {
    container.splice(key as number, 1);
  } else {
    delete (container as Container)[key];
  }
}

function expectConsistent(data: DataSet): void {
  const nodeIds = new Set(Object.values(data).flatMap((universe) => universe.nodes.map((node) => node.id)));

  for (const universe of Object.values(data)) {
    const localNodeIds = new Set(universe.nodes.map((node) => node.id));
    for (const relation of universe.relations) {
      expect(localNodeIds.has(relation.from)).toBe(true);
      expect(localNodeIds.has(relation.to)).toBe(true);
    }
    for (const question of universe.questions) {
      expect(localNodeIds.has(question.targetNodeId)).toBe(true);
      for (const revealedId of [...question.requiresRevealed, ...(question.alsoRevealed ?? [])]) {
        expect(nodeIds.has(revealedId)).toBe(true);
      }
    }
  }
}

const ORIGINE = 'origine';
const AUTRE = 'autre';

const exampleUniverses = [
  buildUniverse({
    id: ORIGINE,
    name: 'Origine',
    kind: 'tale',
    tagline: '',
    nodes: [node('n-garde'), node('n-cible')],
    relations: [],
    questions: [question('q-cible', 'n-cible')],
  }),
  buildUniverse({
    id: AUTRE,
    name: 'Autre',
    kind: 'tale',
    tagline: '',
    nodes: [node('a-1')],
    relations: [],
    questions: [
      question('q-req', 'a-1', { requiresRevealed: ['n-cible'] }),
      question('q-rev', 'a-1', { alsoRevealed: ['n-cible'] }),
      question('q-mixte', 'a-1', { requiresRevealed: ['n-garde'], alsoRevealed: ['n-cible'] }),
    ],
  }),
];

describe('suppression de nœud', () => {
  for (const universe of fixtureUniverses) {
    for (const node of universe.nodes) {
      it(`supprime ${node.id} sans laisser de référence cassée`, () => {
        const data = snapshotOf(fixtureUniverses);
        const plan = planNodeDeletion(fixtureUniverses, universe.id, node.id);

        for (const edit of plan.edits) applyEdit(data, edit);

        const updated = data[universe.id] as UniverseData;
        expect(updated.nodes.some((candidate) => candidate.id === node.id)).toBe(false);
        expect(updated.nodes).toHaveLength(universe.nodes.length - 1);
        expectConsistent(data);
      });
    }
  }

  it('compte les prérequis et les révélations qui citent le nœud supprimé', () => {
    const plan = planNodeDeletion(exampleUniverses, ORIGINE, 'n-cible');
    expect(plan.counts).toEqual({ relations: 0, questions: 1, requirements: 1, reveals: 2 });
  });

  it('retire le nœud des listes de révélation et de prérequis des autres univers', () => {
    const data = snapshotOf(exampleUniverses);
    for (const edit of planNodeDeletion(exampleUniverses, ORIGINE, 'n-cible').edits) applyEdit(data, edit);

    const questions = Object.fromEntries(data[AUTRE]?.questions.map((candidate) => [candidate.id, candidate]) ?? []);
    expect(questions['q-req']?.requiresRevealed).toEqual([]);
    expect(questions['q-rev']?.alsoRevealed).toEqual([]);
    expect(questions['q-mixte']).toMatchObject({ requiresRevealed: ['n-garde'], alsoRevealed: [] });
    expect(data[ORIGINE]?.questions).toEqual([]);
  });
});
