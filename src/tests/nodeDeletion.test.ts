import { describe, expect, it } from 'vitest';
import { universes } from '../data';
import type { UniverseData } from '../domain/types';
import type { ContentPath, ScopedEdit } from '../setup/api';
import { planNodeDeletion } from '../setup/nodeDeletion';

type Container = Record<string | number, unknown>;
type DataSet = Record<string, UniverseData>;

const allUniverses = Object.values(universes);

function snapshot(): DataSet {
  return Object.fromEntries(
    allUniverses.map(({ id, name, kind, tagline, nodes, relations, echoes, questions, ending }) => [
      id,
      structuredClone({ id, name, kind, tagline, nodes, relations, echoes, questions, ending }),
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
  const questionIds = new Set(Object.values(data).flatMap((universe) => universe.questions.map((question) => question.id)));

  for (const universe of Object.values(data)) {
    const localNodeIds = new Set(universe.nodes.map((node) => node.id));
    for (const relation of universe.relations) {
      expect(localNodeIds.has(relation.from)).toBe(true);
      expect(localNodeIds.has(relation.to)).toBe(true);
    }
    for (const echo of universe.echoes) {
      expect(localNodeIds.has(echo.sourceNodeId)).toBe(true);
      expect(nodeIds.has(echo.targetNodeId)).toBe(true);
    }
    for (const question of universe.questions) {
      expect(localNodeIds.has(question.targetNodeId)).toBe(true);
      for (const revealedId of question.requiresRevealed) expect(nodeIds.has(revealedId)).toBe(true);
    }
    for (const node of universe.nodes) {
      for (const section of node.sections) {
        if (section.unlockedByQuestionId) expect(questionIds.has(section.unlockedByQuestionId)).toBe(true);
      }
    }
  }
}

describe('suppression de nœud', () => {
  for (const universe of allUniverses) {
    for (const node of universe.nodes) {
      it(`supprime ${node.id} sans laisser de référence cassée`, () => {
        const data = snapshot();
        const plan = planNodeDeletion(allUniverses, universe.id, node.id);

        for (const edit of plan.edits) applyEdit(data, edit);

        const updated = data[universe.id] as UniverseData;
        expect(updated.nodes.some((candidate) => candidate.id === node.id)).toBe(false);
        expect(updated.nodes).toHaveLength(universe.nodes.length - 1);
        expectConsistent(data);
      });
    }
  }

  it('compte les questions qui exigent le nœud supprimé', () => {
    const plan = planNodeDeletion(allUniverses, 'tale-bois-de-brume', 'u1-nuit');
    expect(plan.counts.requirements).toBe(2);
  });

  it('retire les échos entrants depuis un autre univers', () => {
    const owner = allUniverses.find((universe) => universe.nodeById.has('u2-gorm'));
    const plan = planNodeDeletion(allUniverses, owner?.id ?? '', 'u2-gorm');
    expect(plan.counts.echoes).toBe(1);
  });
});
