import type { Universe } from '../domain/types';
import type { ContentPath, ScopedEdit } from './api';

export interface NodeDeletionPlan {
  edits: ScopedEdit[];
  counts: { relations: number; questions: number; requirements: number; reveals: number };
}

export function planNodeDeletion(universes: Universe[], universeId: string, nodeId: string): NodeDeletionPlan {
  const universe = universes.find((candidate) => candidate.id === universeId);
  if (!universe) throw new Error(`Univers introuvable : ${universeId}`);

  const edits: ScopedEdit[] = [];
  const counts = { relations: 0, questions: 0, requirements: 0, reveals: 0 };
  const remove = (path: ContentPath) => edits.push({ universeId: universe.id, op: 'delete', path });

  const removedQuestionIds = new Set(
    universe.questions.filter((question) => question.targetNodeId === nodeId).map((question) => question.id),
  );
  for (const questionId of removedQuestionIds) remove(['questions', { id: questionId }]);
  counts.questions = removedQuestionIds.size;

  for (const relation of universe.relations) {
    if (relation.from !== nodeId && relation.to !== nodeId) continue;
    remove(['relations', { id: relation.id }]);
    counts.relations += 1;
  }

  for (const other of universes) {
    for (const question of other.questions) {
      if (removedQuestionIds.has(question.id)) continue;
      if (question.requiresRevealed.includes(nodeId)) {
        edits.push({
          universeId: other.id,
          op: 'set',
          path: ['questions', { id: question.id }, 'requiresRevealed'],
          value: question.requiresRevealed.filter((id) => id !== nodeId),
        });
        counts.requirements += 1;
      }
      if (question.alsoRevealed?.includes(nodeId)) {
        edits.push({
          universeId: other.id,
          op: 'set',
          path: ['questions', { id: question.id }, 'alsoRevealed'],
          value: question.alsoRevealed.filter((id) => id !== nodeId),
        });
        counts.reveals += 1;
      }
    }
  }

  remove(['nodes', { id: nodeId }]);
  return { edits, counts };
}
