import { neighbourIds } from './universe';
import type { GameState, Universe, Visibility } from './types';

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

export function visibilityFor(state: GameState, universe: Universe): VisibilityMap {
  return computeVisibility(universe, new Set(state.revealed[universe.id] ?? []));
}

export function unreachableNodeIds(universes: Universe[], universe: Universe): Set<string> {
  const revealable = new Set<string>();
  for (const candidate of universes) {
    for (const question of candidate.questions) {
      revealable.add(question.targetNodeId);
      for (const nodeId of question.alsoRevealed ?? []) revealable.add(nodeId);
    }
  }
  return new Set(
    universe.nodes
      .filter((node) => !node.revealedAtStart && !revealable.has(node.id))
      .map((node) => node.id),
  );
}

export function visibleRelationIds(universe: Universe, visibility: VisibilityMap): Set<string> {
  return new Set(
    universe.relations
      .filter((relation) => visibility.get(relation.from) !== 'hidden' && visibility.get(relation.to) !== 'hidden')
      .map((relation) => relation.id),
  );
}
