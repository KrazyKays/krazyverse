import type { Echo, Question, Relation, StoryNode, StorySection, Universe } from '../domain/types';
import type { ScopedEdit } from './api';

export interface NodeCopyPlan {
  edits: ScopedEdit[];
  newNodeId: string;
  counts: { questions: number; relations: number; echoes: number; skippedLinks: number; lostUnlocks: number };
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
  const takenSectionIds = new Set(
    universes.flatMap((universe) => universe.nodes.flatMap((candidate) => candidate.sections.map((section) => section.id))),
  );
  const takenRelationIds = new Set(universes.flatMap((universe) => universe.relations.map((relation) => relation.id)));
  const takenEchoIds = new Set(universes.flatMap((universe) => universe.echoes.map((echo) => echo.id)));

  const newNodeId = uniqueId(`${node.id}-copie`, takenNodeIds);
  const counts = { questions: 0, relations: 0, echoes: 0, skippedLinks: 0, lostUnlocks: 0 };

  const mapLinked = (linkedId: string): string | undefined => {
    if (linkedId === node.id) return newNodeId;
    const linked = nodeIndex.get(linkedId);
    return linked ? findHomologue(target, linked)?.id : undefined;
  };
  const keep = (linkedId: string): string | undefined => {
    const mapped = mapLinked(linkedId);
    if (mapped === undefined) counts.skippedLinks += 1;
    return mapped;
  };

  const questionIds = new Map<string, string>();
  const questions: Question[] = [];
  for (const question of source.questions) {
    if (question.targetNodeId !== node.id) continue;
    const id = uniqueId(`q-${newNodeId}`, takenQuestionIds);
    questionIds.set(question.id, id);
    const requiresRevealed = question.requiresRevealed.map(keep).filter((mapped): mapped is string => mapped !== undefined);
    questions.push({ ...question, id, targetNodeId: newNodeId, requiresRevealed });
  }

  const sections = node.sections.map((section): StorySection => {
    const { unlockedByQuestionId, ...rest } = section;
    const id = uniqueId(`${newNodeId}-section`, takenSectionIds);
    if (unlockedByQuestionId === undefined) return { ...rest, id };
    const questionId = questionIds.get(unlockedByQuestionId);
    if (questionId === undefined) {
      counts.lostUnlocks += 1;
      return { ...rest, id };
    }
    return { ...rest, id, unlockedByQuestionId: questionId };
  });

  const relations: Relation[] = [];
  for (const relation of source.relations) {
    if (relation.from !== node.id && relation.to !== node.id) continue;
    const from = keep(relation.from);
    const to = keep(relation.to);
    if (from === undefined || to === undefined) continue;
    relations.push({ id: uniqueId(`link-${from}-${to}`, takenRelationIds), from, to });
  }

  const echoes: Echo[] = [];
  for (const echo of source.echoes) {
    if (echo.sourceNodeId !== node.id) continue;
    const targetNodeId = keep(echo.targetNodeId);
    if (targetNodeId === undefined) continue;
    echoes.push({
      id: uniqueId(`echo-${newNodeId}-${targetNodeId}`, takenEchoIds),
      sourceNodeId: newNodeId,
      targetNodeId,
    });
  }

  const pushInto = (path: 'nodes' | 'questions' | 'relations' | 'echoes', value: unknown): ScopedEdit => ({
    universeId: target.id,
    op: 'push',
    path: [path],
    value,
  });

  return {
    edits: [
      pushInto('nodes', { ...node, id: newNodeId, sections }),
      ...questions.map((question) => pushInto('questions', question)),
      ...relations.map((relation) => pushInto('relations', relation)),
      ...echoes.map((echo) => pushInto('echoes', echo)),
    ],
    newNodeId,
    counts: {
      ...counts,
      questions: questions.length,
      relations: relations.length,
      echoes: echoes.length,
    },
  };
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let index = 2;
  while (taken.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  taken.add(id);
  return id;
}
