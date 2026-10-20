import { describe, expect, it } from 'vitest';
import { buildUniverse } from '../domain/universe';
import { nodeIdError, planNodeRename } from '../setup/nodeRename';
import { node, question } from './fixtures/builders';

const universes = [
  buildUniverse({
    id: 'a',
    name: 'a',
    kind: 'tale',
    tagline: '',
    nodes: [node('n1'), node('n2')],
    relations: [{ id: 'r1', from: 'n1', to: 'n2' }],
    questions: [
      question('q1', 'n1', { alsoRevealed: ['b1'] }),
      question('q2', 'n2', { requiresRevealed: ['n1'], alsoRevealed: ['n1'] }),
    ],
  }),
  buildUniverse({
    id: 'b',
    name: 'b',
    kind: 'tale',
    tagline: '',
    nodes: [node('b1')],
    relations: [],
    questions: [question('qb', 'b1', { requiresRevealed: ['n1', 'b1'], alsoRevealed: ['n1'] })],
  }),
];

function editAt(edits: ReturnType<typeof planNodeRename>, universeId: string, path: unknown[]) {
  const edit = edits.find((candidate) => candidate.universeId === universeId && JSON.stringify(candidate.path) === JSON.stringify(path));
  return edit?.op === 'set' ? edit : undefined;
}

describe('renommage de nœud', () => {
  it('met à jour les références dans son univers et dans les autres univers', () => {
    const edits = planNodeRename(universes, 'a', 'n1', 'n1-bis');

    expect(editAt(edits, 'a', ['nodes', { id: 'n1' }, 'id'])?.value).toBe('n1-bis');
    expect(editAt(edits, 'a', ['relations', { id: 'r1' }, 'from'])?.value).toBe('n1-bis');
    expect(editAt(edits, 'a', ['questions', { id: 'q1' }, 'targetNodeId'])?.value).toBe('n1-bis');
    expect(editAt(edits, 'a', ['questions', { id: 'q2' }, 'requiresRevealed'])?.value).toEqual(['n1-bis']);
    expect(editAt(edits, 'a', ['questions', { id: 'q2' }, 'alsoRevealed'])?.value).toEqual(['n1-bis']);
    expect(editAt(edits, 'b', ['questions', { id: 'qb' }, 'requiresRevealed'])?.value).toEqual(['n1-bis', 'b1']);
    expect(editAt(edits, 'b', ['questions', { id: 'qb' }, 'alsoRevealed'])?.value).toEqual(['n1-bis']);
  });

  it("renomme le nœud en dernier, pour que les autres chemins restent valides", () => {
    const edits = planNodeRename(universes, 'a', 'n1', 'n1-bis');
    expect(edits.at(-1)?.path).toEqual(['nodes', { id: 'n1' }, 'id']);
  });

  it('refuse un identifiant déjà utilisé dans un autre univers', () => {
    expect(() => planNodeRename(universes, 'a', 'n1', 'b1')).toThrow('Cet identifiant existe déjà.');
  });

  it('refuse un identifiant mal formé', () => {
    expect(nodeIdError(universes, 'Mauvais Id')).toBe('Identifiant requis : minuscules, chiffres et tirets.');
    expect(() => planNodeRename(universes, 'a', 'n1', 'Mauvais Id')).toThrow();
  });

  it('accepte un identifiant libre et valide', () => {
    expect(nodeIdError(universes, 'n1-bis')).toBeNull();
  });
});
