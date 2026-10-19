import { describe, expect, it } from 'vitest';
import { universes } from '../data';

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
        for (const echo of universe.echoes) {
          expect(nodeIds).toContain(echo.sourceNodeId);
          expect(allNodeIds.has(echo.targetNodeId)).toBe(true);
        }
      });

      it('a des questions cohérentes avec leurs nœuds et leurs choix', () => {
        for (const question of universe.questions) {
          expect(nodeIds).toContain(question.targetNodeId);
          const choiceIds = question.choices.map((choice) => choice.id);
          expect(new Set(choiceIds).size).toBe(choiceIds.length);
          expect(choiceIds).toContain(question.correctChoiceId);
          for (const revealedId of question.requiresRevealed) {
            expect(allNodeIds.has(revealedId)).toBe(true);
          }
        }
      });

      it('débloque les sections par des questions existantes', () => {
        for (const node of universe.nodes) {
          for (const section of node.sections) {
            if (section.unlockedByQuestionId) {
              expect(questionIds).toContain(section.unlockedByQuestionId);
            }
          }
        }
      });
    });
  }
});
