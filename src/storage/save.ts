import type { UniverseMap } from '../domain/progression';
import { START_UNIVERSE_ID } from '../domain/progression';
import type { GameState, JournalEntry } from '../domain/types';

export const SAVE_KEY = 'multiverse-game-save-v1';
// Version 2 : histoire réécrite, les sauvegardes de la version 1 ne correspondent plus au contenu.
const SAVE_VERSION = 2;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ResolvedStore {
  store: KeyValueStore;
  persistent: boolean;
}

function createMemoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

export function resolveStore(): ResolvedStore {
  try {
    const probe = '__multiverse_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return { store: window.localStorage, persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function sanitizeJournal(raw: unknown, universes: UniverseMap): JournalEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: JournalEntry[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    const universe = typeof entry.universeId === 'string' ? universes[entry.universeId] : undefined;
    if (!universe) continue;

    if (entry.type === 'visit' || entry.type === 'ending') {
      entries.push({ type: entry.type, universeId: universe.id });
      continue;
    }

    if (typeof entry.nodeId !== 'string' || !universe.nodeById.has(entry.nodeId)) continue;

    if (entry.type === 'reveal') {
      entries.push({ type: 'reveal', universeId: universe.id, nodeId: entry.nodeId });
    }
  }

  return entries;
}

export function sanitizeState(raw: unknown, universes: UniverseMap): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const knownUniverses = new Set(Object.keys(universes));
  const knownQuestionIds = new Set([...knownUniverses].flatMap((id) => universes[id]?.questions.map((q) => q.id) ?? []));

  if (typeof data.revealed !== 'object' || data.revealed === null) return null;
  const revealed: Record<string, string[]> = {};
  for (const universeId of knownUniverses) {
    const ids = (data.revealed as Record<string, unknown>)[universeId];
    if (!isStringArray(ids)) continue;
    const universe = universes[universeId];
    revealed[universeId] = [...new Set(ids.filter((id) => universe?.nodeById.has(id)))];
  }

  const currentUniverseId =
    typeof data.currentUniverseId === 'string' && knownUniverses.has(data.currentUniverseId)
      ? data.currentUniverseId
      : START_UNIVERSE_ID;

  const pickKnown = (value: unknown, known: Set<string>): string[] =>
    isStringArray(value) ? [...new Set(value.filter((id) => known.has(id)))] : [];

  const visited = pickKnown(data.visited, knownUniverses);
  if (!visited.includes(START_UNIVERSE_ID)) visited.push(START_UNIVERSE_ID);

  const state: GameState = {
    currentUniverseId,
    revealed,
    answeredQuestions: pickKnown(data.answeredQuestions, knownQuestionIds),
    visited,
    unseen: pickKnown(data.unseen, knownUniverses),
    journal: sanitizeJournal(data.journal, universes),
  };

  return state;
}

export function loadGame(store: KeyValueStore, universes: UniverseMap): GameState | null {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const envelope = parsed as { version?: unknown; state?: unknown };
    if (envelope.version !== SAVE_VERSION) return null;
    return sanitizeState(envelope.state, universes);
  } catch {
    return null;
  }
}

export function saveGame(store: KeyValueStore, state: GameState): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
    return true;
  } catch {
    return false;
  }
}

export function clearGame(store: KeyValueStore): void {
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    // Le stockage est indisponible : rien à effacer.
  }
}
