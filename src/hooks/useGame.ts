import { useCallback, useState } from 'react';
import { universes } from '../data';
import { answerQuestion, createInitialState, visitUniverse } from '../domain/progression';
import type { GameState } from '../domain/types';
import { clearGame, loadGame, resolveStore, saveGame } from '../storage/save';

const storage = resolveStore();

export interface GameController {
  state: GameState;
  persistent: boolean;
  saveFailed: boolean;
  selectUniverse: (universeId: string) => void;
  answer: (universeId: string, questionId: string, choiceId: string) => boolean;
  reset: () => void;
}

export function useGame(): GameController {
  const [state, setState] = useState<GameState>(
    () => loadGame(storage.store, universes) ?? createInitialState(universes),
  );
  const [saveFailed, setSaveFailed] = useState(false);

  const commit = useCallback((next: GameState) => {
    setState(next);
    setSaveFailed(!saveGame(storage.store, next));
  }, []);

  const selectUniverse = useCallback(
    (universeId: string) => {
      commit(visitUniverse(state, universeId));
    },
    [state, commit],
  );

  const answer = useCallback(
    (universeId: string, questionId: string, choiceId: string) => {
      const result = answerQuestion(state, universes, universeId, questionId, choiceId);
      if (result.correct) commit(result.state);
      return result.correct;
    },
    [state, commit],
  );

  const reset = useCallback(() => {
    clearGame(storage.store);
    setState(createInitialState(universes));
    setSaveFailed(false);
  }, []);

  return {
    state,
    persistent: storage.persistent,
    saveFailed,
    selectUniverse,
    answer,
    reset,
  };
}
