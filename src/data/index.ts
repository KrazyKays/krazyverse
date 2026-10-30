import { parse } from 'yaml';
import { buildUniverse } from '../domain/universe';
import type { UniverseMap } from '../domain/progression';
import type { Universe, UniverseData } from '../domain/types';

// Chaque fichier content/*.yaml décrit un univers ; en ajouter un suffit à l'intégrer au jeu.
const sources = import.meta.glob<string>('../../content/*.yaml', { query: '?raw', import: 'default', eager: true });

const loaded = Object.keys(sources)
  .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
  .map((file) => buildUniverse(parse(sources[file]!) as UniverseData));

const central = loaded.find((universe) => universe.kind === 'meta');
if (!central) throw new Error('Aucun univers central (kind: meta) dans content/.');

export const META_ID = central.id;

/** Univers central d'abord, puis les contes dans l'ordre des fichiers. */
export const orderedUniverses: Universe[] = [central, ...loaded.filter((universe) => universe !== central)];

export const universes: UniverseMap = Object.fromEntries(orderedUniverses.map((universe) => [universe.id, universe]));
