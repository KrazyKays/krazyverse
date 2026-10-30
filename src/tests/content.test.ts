import { describe, expect, it } from 'vitest';
import { META_ID, orderedUniverses, universes } from '../data';
import { normalizeAnswer } from '../domain/answers';
import { answerQuestion, availableQuestions, createInitialState, isEnded, isRevealed } from '../domain/progression';
import { unreachableNodeIds } from '../domain/visibility';

const allNodes = orderedUniverses.flatMap((universe) => universe.nodes);
const allQuestions = orderedUniverses.flatMap((universe) => universe.questions.map((question) => ({ universe, question })));
const nodeIds = new Set(allNodes.map((node) => node.id));

describe('contenu de content/*.yaml', () => {
  it('a des identifiants uniques', () => {
    expect(nodeIds.size).toBe(allNodes.length);
    expect(new Set(allQuestions.map(({ question }) => question.id)).size).toBe(allQuestions.length);
  });

  it('ne référence que des nœuds existants', () => {
    for (const universe of orderedUniverses) {
      for (const relation of universe.relations) {
        expect(universe.nodeById.has(relation.from), relation.id).toBe(true);
        expect(universe.nodeById.has(relation.to), relation.id).toBe(true);
      }
    }
    for (const { universe, question } of allQuestions) {
      expect(universe.nodeById.has(question.targetNodeId), question.id).toBe(true);
      for (const id of [...question.requiresRevealed, ...(question.alsoRevealed ?? [])]) {
        expect(nodeIds.has(id), `${question.id} → ${id}`).toBe(true);
      }
    }
  });

  it('rend chaque nœud révélable', () => {
    for (const universe of orderedUniverses) {
      expect([...unreachableNodeIds(orderedUniverses, universe)], universe.id).toEqual([]);
    }
  });

  it('cache chaque réponse dans un récit du jeu', () => {
    const corpus = normalizeAnswer(
      orderedUniverses
        .flatMap((universe) => [universe.name, universe.tagline, ...universe.nodes.map((node) => node.intro)])
        .join(' '),
    );
    for (const { question } of allQuestions) {
      const found = question.answers.some((answer) => ` ${corpus} `.includes(` ${normalizeAnswer(answer)} `));
      expect(found, question.id).toBe(true);
    }
  });

  it('peut être terminé en répondant aux pistes ouvertes', () => {
    let state = createInitialState(universes);
    for (let guard = 0; guard < allQuestions.length; guard++) {
      const next = orderedUniverses.flatMap((universe) =>
        availableQuestions(state, universe).map((question) => ({ universe, question })),
      )[0];
      if (!next) break;
      const result = answerQuestion(state, universes, next.universe.id, next.question.id, next.question.answers[0]!);
      expect(result.correct, next.question.id).toBe(true);
      state = result.state;
    }

    expect(isEnded(state, universes[META_ID]!)).toBe(true);
    const veiled = allNodes.filter((node) => !orderedUniverses.some((universe) => isRevealed(state, universe.id, node.id)));
    expect(veiled.map((node) => node.id)).toEqual([]);
  });
});
