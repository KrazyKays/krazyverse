import { describe, expect, it } from 'vitest';
import { universes } from '../data';
import type { ScopedEdit } from '../setup/api';
import { findHomologue, planNodeCopy } from '../setup/nodeCopy';

const allUniverses = Object.values(universes);
const allNodeIds = new Set(allUniverses.flatMap((universe) => universe.nodes.map((node) => node.id)));
const allQuestionIds = new Set(allUniverses.flatMap((universe) => universe.questions.map((question) => question.id)));

function pushed(edits: ScopedEdit[], key: string): Record<string, unknown>[] {
  return edits.flatMap((edit) => (edit.op === 'push' && edit.path[0] === key ? [edit.value as Record<string, unknown>] : []));
}

describe('copie de nœud', () => {
  it("recrée les liens vers les homologues présents dans l'univers cible", () => {
    const plan = planNodeCopy(allUniverses, 'tale-bois-de-brume', 'u1-aniel', 'tale-forges-de-verre');
    const relations = pushed(plan.edits, 'relations');
    const echoes = pushed(plan.edits, 'echoes');

    expect(plan.newNodeId).toBe('u1-aniel-copie');
    expect(relations.map((relation) => relation.to).sort()).toEqual(['u2-cueillette', 'u2-sentier']);
    expect(echoes).toEqual([{ id: 'echo-u1-aniel-copie-u2-aniel', sourceNodeId: 'u1-aniel-copie', targetNodeId: 'u2-aniel' }]);
    expect(plan.counts).toEqual({ questions: 0, relations: 2, echoes: 1, skippedLinks: 1, lostUnlocks: 0 });
  });

  it("refuse de copier un nœud qui a déjà un homologue dans l'univers cible", () => {
    expect(() => planNodeCopy(allUniverses, 'tale-bois-de-brume', 'u1-gorm', 'tale-forges-de-verre')).toThrow();
  });

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
          for (const echo of pushed(plan.edits, 'echoes')) {
            expect(nodeIds.has(echo.sourceNodeId as string)).toBe(true);
            expect(nodeIds.has(echo.targetNodeId as string)).toBe(true);
          }
          for (const question of pushed(plan.edits, 'questions')) {
            expect(question.targetNodeId).toBe(plan.newNodeId);
            for (const revealedId of question.requiresRevealed as string[]) expect(nodeIds.has(revealedId)).toBe(true);
          }
          const copy = pushed(plan.edits, 'nodes')[0] as unknown as { sections: { unlockedByQuestionId?: string }[] };
          for (const section of copy.sections) {
            if (section.unlockedByQuestionId) expect(questionIds.has(section.unlockedByQuestionId)).toBe(true);
          }
        });
      }
    }
  }
});
