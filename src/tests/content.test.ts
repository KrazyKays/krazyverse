import { describe, expect, it } from 'vitest';
import { universes } from '../data';
import { normalizeAnswer } from '../domain/answers';

const allNodeIds = new Set(Object.values(universes).flatMap((universe) => universe.nodes.map((node) => node.id)));

describe('contenu éditable', () => {
  for (const universe of Object.values(universes)) {
    describe(universe.name, () => {
      const nodeIds = universe.nodes.map((node) => node.id);
      const questionIds = universe.questions.map((question) => question.id);

      it('n\'a pas de doublons d\'ids', () => {
        expect(new Set(nodeIds).size).toBe(nodeIds.length);
        expect(new Set(questionIds).size).toBe(questionIds.length);
      });

      it('ne relie que des nœuds existants', () => {
        for (const relation of universe.relations) {
          expect(nodeIds).toContain(relation.from);
          expect(nodeIds).toContain(relation.to);
        }
      });

      it('a des questions cohérentes avec leurs nœuds et leurs réponses', () => {
        for (const question of universe.questions) {
          expect(nodeIds).toContain(question.targetNodeId);
          expect(question.answers.length).toBeGreaterThan(0);
          for (const answer of question.answers) {
            expect(normalizeAnswer(answer)).not.toBe('');
          }
          for (const revealedId of [...question.requiresRevealed, ...(question.alsoRevealed ?? [])]) {
            expect(allNodeIds.has(revealedId)).toBe(true);
          }
        }
      });
    });
  }
});
