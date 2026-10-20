import { neighbourIds } from './universe';
import type { Universe, Visibility } from './types';

export type VisibilityMap = Map<string, Visibility>;

export function computeVisibility(universe: Universe, revealed: ReadonlySet<string>): VisibilityMap {
  const visibility: VisibilityMap = new Map();

  for (const node of universe.nodes) {
    if (revealed.has(node.id)) {
      visibility.set(node.id, 'revealed');
      continue;
    }
    const adjacentToRevealed = neighbourIds(universe, node.id).some((id) => revealed.has(id));
    visibility.set(node.id, adjacentToRevealed ? 'censored' : 'hidden');
  }

  return visibility;
}

export function visibleRelationIds(universe: Universe, visibility: VisibilityMap): string[] {
  return universe.relations
    .filter((relation) => visibility.get(relation.from) !== 'hidden' && visibility.get(relation.to) !== 'hidden')
    .map((relation) => relation.id);
}
