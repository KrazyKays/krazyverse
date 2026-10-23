import { describe, expect, it } from 'vitest';
import { buildUniverse } from '../domain/universe';
import { unreachableNodeIds } from '../domain/visibility';
import { node, question } from './fixtures/builders';

const universes = [
  buildUniverse({
    id: 'a',
    name: 'a',
    kind: 'tale',
    tagline: '',
    nodes: [node('n-start', { revealedAtStart: true }), node('n-target'), node('n-also'), node('n-orphan'), node('n-required')],
    relations: [],
    questions: [question('q1', 'n-target', { requiresRevealed: ['n-required'], alsoRevealed: ['b-cross'] })],
  }),
  buildUniverse({
    id: 'b',
    name: 'b',
    kind: 'tale',
    tagline: '',
    nodes: [node('b-cross'), node('b-orphan')],
    relations: [],
    questions: [question('qb', 'b-orphan', { alsoRevealed: ['n-also'] })],
  }),
];

describe('nœuds jamais révélables', () => {
  it('ignore les nœuds révélés au départ, ciblés par une question, ou cités comme révélation', () => {
    const unreachable = unreachableNodeIds(universes, universes[0]!);
    expect([...unreachable]).toEqual(['n-orphan', 'n-required']);
  });

  it('prend en compte les révélations venant d\'un autre univers', () => {
    const unreachable = unreachableNodeIds(universes, universes[1]!);
    expect([...unreachable]).toEqual([]);
  });
});
