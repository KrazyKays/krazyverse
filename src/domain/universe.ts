import type { Universe, UniverseData } from './types';

export function buildUniverse(data: UniverseData): Universe {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  return { ...data, nodeById };
}

export function neighbourIds(universe: Universe, nodeId: string): string[] {
  const neighbours: string[] = [];
  for (const relation of universe.relations) {
    if (relation.from === nodeId) neighbours.push(relation.to);
    else if (relation.to === nodeId) neighbours.push(relation.from);
  }
  return neighbours;
}
