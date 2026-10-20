import { describe, expect, it } from 'vitest';
import { universes } from '../data';
import { buildUniverse } from '../domain/universe';
import type { Question, StoryNode } from '../domain/types';
import type { ScopedEdit } from '../setup/api';
import { findHomologue, planNodeCopy } from '../setup/nodeCopy';

const allUniverses = Object.values(universes);
const allNodeIds = new Set(allUniverses.flatMap((universe) => universe.nodes.map((node) => node.id)));
const allQuestionIds = new Set(allUniverses.flatMap((universe) => universe.questions.map((question) => question.id)));

function pushed(edits: ScopedEdit[], key: string): Record<string, unknown>[] {
  return edits.flatMap((edit) => (edit.op === 'push' && edit.path[0] === key ? [edit.value as Record<string, unknown>] : []));
}

function node(id: string, homologueKey: string, extra: Partial<StoryNode> = {}): StoryNode {
  return { id, kind: 'place', title: id, position: { x: 0, y: 0 }, homologueKey, intro: '', ...extra };
}

function question(id: string, targetNodeId: string, requiresRevealed: string[] = [], alsoRevealed: string[] = []): Question {
  return { id, targetNodeId, access: 'adjacent', requiresRevealed, alsoRevealed, context: '', prompt: '', answers: ['x'], wrongFeedback: '' };
}

const bois = buildUniverse({
  id: 'tale-bois-de-brume',
  name: 'Bois',
  kind: 'tale',
  tagline: '',
  nodes: [node('a-centre', 'centre', { revealedAtStart: true }), node('a-sentier', 'sentier'), node('a-gorm', 'gorm')],
  relations: [
    { id: 'r-centre-sentier', from: 'a-centre', to: 'a-sentier' },
    { id: 'r-sentier-gorm', from: 'a-sentier', to: 'a-gorm' },
  ],
  questions: [question('qa-sentier', 'a-sentier', ['a-gorm'], ['b-foret'])],
});

const forges = buildUniverse({
  id: 'tale-forges-de-verre',
  name: 'Forges',
  kind: 'tale',
  tagline: '',
  nodes: [node('b-centre', 'centre', { revealedAtStart: true }), node('b-foret', 'foret')],
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
  for (const source of allUniverses) {
    for (const node of source.nodes) {
      for (const target of allUniverses) {
        if (target.id === source.id || findHomologue(target, node)) continue;
        it(`copie ${node.id} vers ${target.id} sans référence cassée`, () => {
          const plan = planNodeCopy(allUniverses, source.id, node.id, target.id);
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
