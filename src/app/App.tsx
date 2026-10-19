import { useMemo, useState } from 'react';
import { JournalDialog } from '../components/JournalDialog';
import { QuestionDialog } from '../components/QuestionDialog';
import { ResetDialog } from '../components/ResetDialog';
import { SidePanel } from '../components/SidePanel';
import { UniverseGraph } from '../components/UniverseGraph';
import { UniverseSelector } from '../components/UniverseSelector';
import { META_ID, UNIVERSE_ORDER, universes } from '../data';
import { availableQuestions, centralRemaining, isEnded } from '../domain/progression';
import { useGame } from '../hooks/useGame';

export function App() {
  const game = useGame();
  const { state } = game;
  const currentUniverse = universes[state.currentUniverseId];
  const central = universes[META_ID];

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [endingDismissed, setEndingDismissed] = useState(false);

  const questions = useMemo(
    () => (currentUniverse ? availableQuestions(state, currentUniverse) : []),
    [state, currentUniverse],
  );
  const activeQuestion = currentUniverse?.questions.find((question) => question.id === activeQuestionId);

  if (!currentUniverse || !central) {
    return <p className="fatal">Données du jeu introuvables.</p>;
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
              ? 'Enquête centrale résolue'
              : `Enquête centrale — ${remaining} ${remaining > 1 ? 'nœuds restants' : 'nœud restant'}`}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setJournalOpen(true)}>
            Journal
          </button>
          <button type="button" onClick={() => setResetOpen(true)}>
            Réinitialiser
          </button>
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

      <UniverseSelector
        universes={UNIVERSE_ORDER.map((id) => universes[id]).filter((u) => u !== undefined)}
        currentId={currentUniverse.id}
        unseenIds={state.unseen}
        onSelect={switchUniverse}
      />

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
        <section className="graph-area" aria-label="Toile interactive">
          <p className="tagline">{currentUniverse.tagline}</p>
          <UniverseGraph
            universe={currentUniverse}
            state={state}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        </section>

        <SidePanel
          universe={currentUniverse}
          universes={universes}
          state={state}
          selectedNodeId={selectedNodeId}
          questions={questions}
          onSelect={setSelectedNodeId}
          onStartQuestion={setActiveQuestionId}
        />
      </main>

      {activeQuestion && (
        <QuestionDialog
          universe={currentUniverse}
          question={activeQuestion}
          onAnswer={(choiceId) => game.answer(currentUniverse.id, activeQuestion.id, choiceId)}
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
