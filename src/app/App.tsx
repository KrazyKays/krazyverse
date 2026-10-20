import { useEffect, useMemo, useState } from 'react';
import { JournalDialog } from '../components/JournalDialog';
import { QuestionDialog } from '../components/QuestionDialog';
import { ResetDialog } from '../components/ResetDialog';
import { SidePanel } from '../components/SidePanel';
import { UniverseGraph } from '../components/UniverseGraph';
import { UniverseSelector } from '../components/UniverseSelector';
import { META_ID, UNIVERSE_ORDER, universes } from '../data';
import { availableQuestions, centralRemaining, isEnded } from '../domain/progression';
import type { Universe } from '../domain/types';
import { useGame } from '../hooks/useGame';
import { SetupScreen } from '../setup/SetupScreen';

export function App() {
  const game = useGame();
  const { state } = game;
  const currentUniverse = universes[state.currentUniverseId];
  const central = universes[META_ID];
  const orderedUniverses = UNIVERSE_ORDER.map((id) => universes[id]).filter((u): u is Universe => u !== undefined);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [endingDismissed, setEndingDismissed] = useState(false);

  const questions = useMemo(
    () => (currentUniverse ? availableQuestions(state, currentUniverse) : []),
    [state, currentUniverse],
  );
  const activeQuestion = currentUniverse?.questions.find((question) => question.id === activeQuestionId);
  const dialogOpen = activeQuestion !== undefined || journalOpen || resetOpen;

  useEffect(() => {
    if (selectedNodeId === null || dialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNodeId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, dialogOpen]);

  if (!currentUniverse || !central) {
    return <p className="fatal">Données du jeu introuvables.</p>;
  }

  if (import.meta.env.DEV && setupOpen) {
    return (
      <SetupScreen
        universes={orderedUniverses}
        initialUniverseId={currentUniverse.id}
        onClose={() => setSetupOpen(false)}
      />
    );
  }

  const remaining = centralRemaining(state, central);
  const ended = isEnded(state, central);

  const switchUniverse = (universeId: string) => {
    if (universeId === state.currentUniverseId) return;
    game.selectUniverse(universeId);
    setSelectedNodeId(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>Krazyverse</h1>
          <p className="counter" aria-live="polite">
            {ended
              ? 'Question centrale résolue'
              : `Question centrale — ${remaining} ${remaining > 1 ? 'nœuds restants' : 'nœud restant'}`}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setJournalOpen(true)}>
            Journal
          </button>
          <button type="button" onClick={() => setResetOpen(true)}>
            Réinitialiser
          </button>
          {import.meta.env.DEV && (
            <button type="button" onClick={() => setSetupOpen(true)}>
              Setup
            </button>
          )}
        </div>
      </header>

      {!game.persistent && (
        <p className="notice" role="status">
          Stockage local indisponible : la progression sera perdue à la fermeture de la page.
        </p>
      )}
      {game.saveFailed && (
        <p className="notice" role="alert">
          La sauvegarde a échoué : la progression pourrait ne pas être conservée.
        </p>
      )}

      {ended && central.ending && !endingDismissed && (
        <section className="ending" aria-label="Conclusion">
          <h2>{central.ending.title}</h2>
          <p>{central.ending.body}</p>
          <button type="button" onClick={() => setEndingDismissed(true)}>
            Continuer à explorer
          </button>
        </section>
      )}

      <main className="layout">
        <UniverseSelector
          universes={orderedUniverses}
          currentId={currentUniverse.id}
          unseenIds={state.unseen}
          onSelect={switchUniverse}
        />

        <section className="graph-area" aria-label="Toile interactive">
          <p className="tagline">{currentUniverse.tagline}</p>
          <UniverseGraph
            universe={currentUniverse}
            state={state}
            selectedId={selectedNodeId}
            questions={questions}
            onSelect={setSelectedNodeId}
            onDeselect={() => setSelectedNodeId(null)}
            onOpenQuestion={setActiveQuestionId}
          />
        </section>

        <SidePanel
          universe={currentUniverse}
          state={state}
          selectedNodeId={selectedNodeId}
        />
      </main>

      {activeQuestion && (
        <QuestionDialog
          universe={currentUniverse}
          question={activeQuestion}
          onAnswer={(answer) => game.answer(currentUniverse.id, activeQuestion.id, answer)}
          onClose={() => setActiveQuestionId(null)}
        />
      )}

      {journalOpen && (
        <JournalDialog state={state} universes={universes} onClose={() => setJournalOpen(false)} />
      )}

      {resetOpen && (
        <ResetDialog
          onConfirm={() => {
            game.reset();
            setResetOpen(false);
            setSelectedNodeId(null);
            setEndingDismissed(false);
          }}
          onClose={() => setResetOpen(false)}
        />
      )}
    </div>
  );
}
