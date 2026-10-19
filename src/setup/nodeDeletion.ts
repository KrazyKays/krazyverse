import type { Universe } from '../domain/types';
import type { ContentPath, ScopedEdit } from './api';

export interface NodeDeletionPlan {
  edits: ScopedEdit[];
  counts: { relations: number; echoes: number; questions: number; requirements: number };
}

export function planNodeDeletion(universes: Universe[], universeId: string, nodeId: string): NodeDeletionPlan {
  const universe = universes.find((candidate) => candidate.id === universeId);
  if (!universe) throw new Error(`Univers introuvable : ${universeId}`);

  const edits: ScopedEdit[] = [];
  const counts = { relations: 0, echoes: 0, questions: 0, requirements: 0 };
  const remove = (targetUniverseId: string, path: ContentPath) => edits.push({ universeId: targetUniverseId, op: 'delete', path });

  const removedQuestionIds = new Set(
    universe.questions.filter((question) => question.targetNodeId === nodeId).map((question) => question.id),
  );
  for (const questionId of removedQuestionIds) remove(universe.id, ['questions', { id: questionId }]);
  counts.questions = removedQuestionIds.size;

  for (const node of universe.nodes) {
    if (node.id === nodeId) continue;
    for (const section of node.sections) {
      if (section.unlockedByQuestionId && removedQuestionIds.has(section.unlockedByQuestionId)) {
        remove(universe.id, ['nodes', { id: node.id }, 'sections', { id: section.id }, 'unlockedByQuestionId']);
      }
    }
  }

  for (const relation of universe.relations) {
    if (relation.from !== nodeId && relation.to !== nodeId) continue;
    remove(universe.id, ['relations', { id: relation.id }]);
    counts.relations += 1;
  }

  for (const other of universes) {
    for (const echo of other.echoes) {
      if (echo.sourceNodeId !== nodeId && echo.targetNodeId !== nodeId) continue;
      remove(other.id, ['echoes', { id: echo.id }]);
      counts.echoes += 1;
    }

    for (const question of other.questions) {
      if (removedQuestionIds.has(question.id) || !question.requiresRevealed.includes(nodeId)) continue;
      edits.push({
        universeId: other.id,
        op: 'set',
        path: ['questions', { id: question.id }, 'requiresRevealed'],
        value: question.requiresRevealed.filter((id) => id !== nodeId),
      });
      counts.requirements += 1;
    }
  }

  remove(universe.id, ['nodes', { id: nodeId }]);
  return { edits, counts };
}
