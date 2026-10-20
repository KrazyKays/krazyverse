import type { Universe } from '../domain/types';
import type { ScopedEdit } from './api';

const NODE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function nodeIdError(universes: Universe[], nodeId: string): string | null {
  if (!NODE_ID_PATTERN.test(nodeId)) return 'Identifiant requis : minuscules, chiffres et tirets.';
  if (universes.some((candidate) => candidate.nodeById.has(nodeId))) return 'Cet identifiant existe déjà.';
  return null;
}

export function planNodeRename(universes: Universe[], universeId: string, nodeId: string, newId: string): ScopedEdit[] {
  const universe = universes.find((candidate) => candidate.id === universeId);
  if (!universe?.nodeById.has(nodeId)) throw new Error('Nœud introuvable.');
  const problem = nodeIdError(universes, newId);
  if (problem) throw new Error(problem);

  const edits: ScopedEdit[] = [];
  const set = (targetUniverseId: string, path: ScopedEdit['path'], value: unknown) =>
    edits.push({ universeId: targetUniverseId, op: 'set', path, value });

  for (const relation of universe.relations) {
    if (relation.from === nodeId) set(universe.id, ['relations', { id: relation.id }, 'from'], newId);
    if (relation.to === nodeId) set(universe.id, ['relations', { id: relation.id }, 'to'], newId);
  }

  for (const candidate of universes) {
    for (const question of candidate.questions) {
      if (question.targetNodeId === nodeId) {
        set(candidate.id, ['questions', { id: question.id }, 'targetNodeId'], newId);
      }
      for (const key of ['requiresRevealed', 'alsoRevealed'] as const) {
        const ids = question[key] ?? [];
        if (ids.includes(nodeId)) {
          set(
            candidate.id,
            ['questions', { id: question.id }, key],
            ids.map((id) => (id === nodeId ? newId : id)),
          );
        }
      }
    }
  }

  set(universe.id, ['nodes', { id: nodeId }, 'id'], newId);
  return edits;
}
