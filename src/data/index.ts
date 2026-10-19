import { parse } from 'yaml';
import { buildUniverse } from '../domain/universe';
import type { UniverseMap } from '../domain/progression';
import type { UniverseData } from '../domain/types';
import boisDeBrumeSource from '../../content/univers 1.yaml?raw';
import forgesDeVerreSource from '../../content/univers 2.yaml?raw';
import multiversSource from '../../content/multivers.yaml?raw';

function loadUniverse(source: string): UniverseData {
  return parse(source) as UniverseData;
}

const boisDeBrume = loadUniverse(boisDeBrumeSource);
const forgesDeVerre = loadUniverse(forgesDeVerreSource);
const multivers = loadUniverse(multiversSource);

export const BOIS_ID = boisDeBrume.id;
export const FORGES_ID = forgesDeVerre.id;
export const META_ID = multivers.id;

export const UNIVERSE_ORDER = [META_ID, BOIS_ID, FORGES_ID] as const;

export const universes: UniverseMap = {
  [BOIS_ID]: buildUniverse(boisDeBrume),
  [FORGES_ID]: buildUniverse(forgesDeVerre),
  [META_ID]: buildUniverse(multivers),
};
