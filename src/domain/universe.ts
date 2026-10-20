import type { Universe, UniverseData } from './types';

export function buildUniverse(data: UniverseData): Universe {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const relationIdsByNode = new Map<string, string[]>();

  for (const node of data.nodes) {
    relationIdsByNode.set(node.id, []);
  }

  for (const relation of data.relations) {
    relationIdsByNode.get(relation.from)?.push(relation.id);
    relationIdsByNode.get(relation.to)?.push(relation.id);
  }

  return { ...data, nodeById, relationIdsByNode };
}

export function neighbourIds(universe: Universe, nodeId: string): string[] {
  const neighbours: string[] = [];
  for (const relation of universe.relations) {
    if (relation.from === nodeId) neighbours.push(relation.to);
    else if (relation.to === nodeId) neighbours.push(relation.from);
  }
  return neighbours;
}
