import { useCallback, useState } from 'react';
import { universes } from '../data';
import { answerQuestion, createInitialState, visitUniverse, type AnswerResult } from '../domain/progression';
import type { GameState } from '../domain/types';
import { clearGame, loadGame, resolveStore, saveGame } from '../storage/save';

const storage = resolveStore();

export interface GameController {
  state: GameState;
  /** Vrai quand aucune sauvegarde n'existait au chargement de la page. */
  isNewGame: boolean;
  persistent: boolean;
  saveFailed: boolean;
  selectUniverse: (universeId: string) => void;
  answer: (universeId: string, questionId: string, answer: string) => AnswerResult;
  reset: () => void;
}

export function useGame(): GameController {
  const [initial] = useState(() => {
    const saved = loadGame(storage.store, universes);
    return { state: saved ?? createInitialState(universes), isNewGame: saved === null };
  });
  const [state, setState] = useState<GameState>(initial.state);
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
    (universeId: string, questionId: string, answer: string) => {
      const result = answerQuestion(state, universes, universeId, questionId, answer);
      if (result.correct) commit(result.state);
      return result;
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
    isNewGame: initial.isNewGame,
    persistent: storage.persistent,
    saveFailed,
    selectUniverse,
    answer,
    reset,
  };
}
