import type { Question, Relation, StoryNode, Universe } from '../domain/types';
import type { ScopedEdit } from './api';
import { uniqueId } from './ids';

export interface NodeCopyPlan {
  edits: ScopedEdit[];
  newNodeId: string;
  counts: { questions: number; relations: number; skippedLinks: number };
}

export function findHomologue(universe: Universe, node: StoryNode): StoryNode | undefined {
  return universe.nodes.find((candidate) => candidate.homologueKey === node.homologueKey);
}

export function planNodeCopy(universes: Universe[], sourceId: string, nodeId: string, targetId: string): NodeCopyPlan {
  const source = universes.find((candidate) => candidate.id === sourceId);
  const target = universes.find((candidate) => candidate.id === targetId);
  const node = source?.nodeById.get(nodeId);
  if (!source || !target || !node) throw new Error('Nœud ou univers introuvable.');
  if (findHomologue(target, node)) throw new Error('Un homologue existe déjà dans cet univers.');

  const nodeIndex = new Map(universes.flatMap((universe) => universe.nodes).map((candidate) => [candidate.id, candidate]));
  const takenNodeIds = new Set(nodeIndex.keys());
  const takenQuestionIds = new Set(universes.flatMap((universe) => universe.questions.map((question) => question.id)));
  const takenRelationIds = new Set(universes.flatMap((universe) => universe.relations.map((relation) => relation.id)));

  const newNodeId = uniqueId(`${node.id}-copie`, takenNodeIds);
  let skippedLinks = 0;

  const mapLinked = (linkedId: string): string | undefined => {
    if (linkedId === node.id) return newNodeId;
    const linked = nodeIndex.get(linkedId);
    return linked ? findHomologue(target, linked)?.id : undefined;
  };
  const keep = (linkedId: string): string | undefined => {
    const mapped = mapLinked(linkedId);
    if (mapped === undefined) skippedLinks += 1;
    return mapped;
  };
  const keepAll = (linkedIds: string[] | undefined): string[] =>
    (linkedIds ?? []).map(keep).filter((mapped): mapped is string => mapped !== undefined);

  const questions: Question[] = [];
  for (const question of source.questions) {
    if (question.targetNodeId !== node.id) continue;
    const id = uniqueId(`q-${newNodeId}`, takenQuestionIds);
    questions.push({
      ...question,
      id,
      targetNodeId: newNodeId,
      requiresRevealed: keepAll(question.requiresRevealed),
      alsoRevealed: keepAll(question.alsoRevealed),
    });
  }

  const relations: Relation[] = [];
  for (const relation of source.relations) {
    if (relation.from !== node.id && relation.to !== node.id) continue;
    const from = keep(relation.from);
    const to = keep(relation.to);
    if (from === undefined || to === undefined) continue;
    relations.push({ id: uniqueId(`link-${from}-${to}`, takenRelationIds), from, to });
  }

  const pushInto = (path: 'nodes' | 'questions' | 'relations', value: unknown): ScopedEdit => ({
    universeId: target.id,
    op: 'push',
    path: [path],
    value,
  });

  return {
    edits: [
      pushInto('nodes', { ...node, id: newNodeId }),
      ...questions.map((question) => pushInto('questions', question)),
      ...relations.map((relation) => pushInto('relations', relation)),
    ],
    newNodeId,
    counts: {
      questions: questions.length,
      relations: relations.length,
      skippedLinks,
    },
  };
}
