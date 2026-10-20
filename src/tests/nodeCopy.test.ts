import { describe, expect, it } from 'vitest';
import { buildUniverse } from '../domain/universe';
import type { ScopedEdit } from '../setup/api';
import { findHomologue, planNodeCopy } from '../setup/nodeCopy';
import { node, question } from './fixtures/builders';
import { fixtureUniverses } from './fixtures/universes';

const allNodeIds = new Set(fixtureUniverses.flatMap((universe) => universe.nodes.map((node) => node.id)));
const allQuestionIds = new Set(fixtureUniverses.flatMap((universe) => universe.questions.map((question) => question.id)));

function pushed(edits: ScopedEdit[], key: string): Record<string, unknown>[] {
  return edits.flatMap((edit) => (edit.op === 'push' && edit.path[0] === key ? [edit.value as Record<string, unknown>] : []));
}

const bois = buildUniverse({
  id: 'tale-bois-de-brume',
  name: 'Bois',
  kind: 'tale',
  tagline: '',
  nodes: [
    node('a-centre', { homologueKey: 'centre', revealedAtStart: true }),
    node('a-sentier', { homologueKey: 'sentier' }),
    node('a-gorm', { homologueKey: 'gorm' }),
  ],
  relations: [
    { id: 'r-centre-sentier', from: 'a-centre', to: 'a-sentier' },
    { id: 'r-sentier-gorm', from: 'a-sentier', to: 'a-gorm' },
  ],
  questions: [question('qa-sentier', 'a-sentier', { requiresRevealed: ['a-gorm'], alsoRevealed: ['b-foret'] })],
});

const forges = buildUniverse({
  id: 'tale-forges-de-verre',
  name: 'Forges',
  kind: 'tale',
  tagline: '',
  nodes: [node('b-centre', { homologueKey: 'centre', revealedAtStart: true }), node('b-foret', { homologueKey: 'foret' })],
  relations: [],
  questions: [],
});

const exampleUniverses = [bois, forges];

describe('copie de nœud (exemple)', () => {
  it("recrée les liens vers les homologues présents dans l'univers cible", () => {
    const plan = planNodeCopy(exampleUniverses, bois.id, 'a-sentier', forges.id);
    expect(plan.newNodeId).toBe('a-sentier-copie');
    expect(pushed(plan.edits, 'relations').map(({ from, to }) => [from, to])).toEqual([['b-centre', 'a-sentier-copie']]);
    expect(pushed(plan.edits, 'questions')).toEqual([
      expect.objectContaining({
        id: 'q-a-sentier-copie',
        targetNodeId: 'a-sentier-copie',
        requiresRevealed: [],
        alsoRevealed: ['b-foret'],
      }),
    ]);
    expect(plan.counts).toEqual({ questions: 1, relations: 1, skippedLinks: 2 });
  });

  it("refuse de copier un nœud qui a déjà un homologue dans l'univers cible", () => {
    expect(() => planNodeCopy(exampleUniverses, bois.id, 'a-centre', forges.id)).toThrow(
      'Un homologue existe déjà dans cet univers.',
    );
  });
});

describe('copie de nœud (contenu)', () => {
  for (const source of fixtureUniverses) {
    for (const node of source.nodes) {
      for (const target of fixtureUniverses) {
        if (target.id === source.id || findHomologue(target, node)) continue;
        it(`copie ${node.id} vers ${target.id} sans référence cassée`, () => {
          const plan = planNodeCopy(fixtureUniverses, source.id, node.id, target.id);
          const nodeIds = new Set([...allNodeIds, plan.newNodeId]);
          const questionIds = new Set([...allQuestionIds, ...pushed(plan.edits, 'questions').map((question) => question.id as string)]);

          expect(pushed(plan.edits, 'nodes')).toHaveLength(1);
          for (const edit of plan.edits) expect(edit.universeId).toBe(target.id);
          for (const relation of pushed(plan.edits, 'relations')) {
            expect(nodeIds.has(relation.from as string)).toBe(true);
            expect(nodeIds.has(relation.to as string)).toBe(true);
          }
          for (const question of pushed(plan.edits, 'questions')) {
            expect(questionIds.has(question.id as string)).toBe(true);
            expect(question.targetNodeId).toBe(plan.newNodeId);
            for (const revealedId of [...(question.requiresRevealed as string[]), ...(question.alsoRevealed as string[])]) {
              expect(nodeIds.has(revealedId)).toBe(true);
            }
          }
        });
      }
    }
  }
});
