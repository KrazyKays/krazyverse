import type { Question, StoryNode } from '../../domain/types';

export function node(id: string, extra: Partial<StoryNode> = {}): StoryNode {
  return { id, kind: 'place', title: id, position: { x: 0, y: 0 }, homologueKey: id, intro: '', ...extra };
}

export function question(id: string, targetNodeId: string, extra: Partial<Question> = {}): Question {
  return {
    id,
    targetNodeId,
    access: 'adjacent',
    requiresRevealed: [],
    context: '',
    prompt: '',
    answers: ['réponse'],
    wrongFeedback: '',
    ...extra,
  };
}
