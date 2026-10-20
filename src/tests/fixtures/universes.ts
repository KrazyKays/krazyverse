import { parse } from 'yaml';
import { buildUniverse } from '../../domain/universe';
import type { UniverseData } from '../../domain/types';
import taleA from './tale-a.yaml?raw';
import taleB from './tale-b.yaml?raw';
import meta from './meta.yaml?raw';

export const fixtureUniverses = [taleA, taleB, meta].map((source) => buildUniverse(parse(source) as UniverseData));
