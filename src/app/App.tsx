import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { CluesPanel } from '../components/CluesPanel';
import { EndingDialog } from '../components/EndingDialog';
import { JournalDialog } from '../components/JournalDialog';
import { NodePanel } from '../components/NodePanel';
import { QuestionDialog } from '../components/QuestionDialog';
import { ResetDialog } from '../components/ResetDialog';
import { UniverseGraph } from '../components/UniverseGraph';
import { UniverseNav } from '../components/UniverseNav';
import { WelcomeDialog } from '../components/WelcomeDialog';
import { META_ID, orderedUniverses, universes } from '../data';
import { availableQuestions, centralRemaining, isEnded, openQuestions } from '../domain/progression';
import type { NodeRef } from '../domain/types';
import { useGame } from '../hooks/useGame';
import { SetupScreen } from '../setup/SetupScreen';

type PanelTab = 'story' | 'clues';
type OpenDialog = 'help' | 'journal' | 'reset' | 'ending' | null;

export function App() {
  const game = useGame();
  const { state } = game;
  const currentUniverse = universes[state.currentUniverseId];
  const central = universes[META_ID];

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('story');
  const [activeQuestion, setActiveQuestion] = useState<{ universeId: string; questionId: string } | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(game.isNewGame ? 'help' : null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(game.isNewGame);
  const [pendingEnding, setPendingEnding] = useState(false);

  const questions = useMemo(
    () => (currentUniverse ? availableQuestions(state, currentUniverse) : []),
    [state, currentUniverse],
  );
  const clues = useMemo(() => openQuestions(state, orderedUniverses), [state]);

  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selectedNodeId === null || !window.matchMedia('(max-width: 860px)').matches) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [selectedNodeId]);

  const modalOpen = activeQuestion !== null || dialog !== null;
  useEffect(() => {
    if (selectedNodeId === null || modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNodeId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, modalOpen]);

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

  const totalCentral = central.nodes.filter((node) => node.central?.required).length;
  const solvedCentral = totalCentral - centralRemaining(state, central);
  const ended = isEnded(state, central);

  const switchUniverse = (universeId: string) => {
    if (universeId !== state.currentUniverseId) game.selectUniverse(universeId);
    setSelectedNodeId(null);
  };

  const navigate = (target: NodeRef) => {
    switchUniverse(target.universeId);
    setSelectedNodeId(target.nodeId);
    setPanelTab('story');
    setDialog(null);
  };

  const openQuestion = (universeId: string, questionId: string) => {
    switchUniverse(universeId);
    setActiveQuestion({ universeId, questionId });
  };

  const questionUniverse = activeQuestion ? universes[activeQuestion.universeId] : undefined;
  const question = questionUniverse?.questions.find((candidate) => candidate.id === activeQuestion?.questionId);

  const closeQuestion = () => {
    setActiveQuestion(null);
    // La conclusion s'affiche dès que la question qui l'a déclenchée est refermée.
    if (pendingEnding) {
      setPendingEnding(false);
      setDialog('ending');
    }
  };

  return (
    <div className="app">
      <AppHeader
        solved={solvedCentral}
        total={totalCentral}
        ended={ended}
        onOpenJournal={() => setDialog('journal')}
        onOpenHelp={() => setDialog('help')}
        onOpenEnding={() => setDialog('ending')}
        onReset={() => setDialog('reset')}
        onOpenSetup={import.meta.env.DEV ? () => setSetupOpen(true) : undefined}
      />

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

      <main className="layout">
        <UniverseNav universes={orderedUniverses} state={state} onSelect={switchUniverse} />

        <section className="graph-area" aria-label="Toile interactive">
          <header className="graph-header">
            <h2>{currentUniverse.name}</h2>
            <p className="tagline">{currentUniverse.tagline}</p>
          </header>
          <UniverseGraph
            key={currentUniverse.id}
            universe={currentUniverse}
            state={state}
            selectedId={selectedNodeId}
            questions={questions}
            onSelect={(nodeId) => {
              setSelectedNodeId(nodeId);
              setPanelTab('story');
            }}
            onDeselect={() => setSelectedNodeId(null)}
            onOpenQuestion={(questionId) => openQuestion(currentUniverse.id, questionId)}
          />
        </section>

        <aside ref={panelRef} className="side-panel" aria-label="Panneau de lecture">
          <div className="tabs" role="tablist" aria-label="Contenu du panneau">
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === 'story'}
              className={panelTab === 'story' ? 'tab tab--active' : 'tab'}
              onClick={() => setPanelTab('story')}
            >
              Récit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === 'clues'}
              className={panelTab === 'clues' ? 'tab tab--active' : 'tab'}
              onClick={() => setPanelTab('clues')}
            >
              Pistes{clues.length > 0 && <span className="tab-count">{clues.length}</span>}
            </button>
          </div>
          <div className="panel-body" role="tabpanel">
            {panelTab === 'story' ? (
              <NodePanel
                universe={currentUniverse}
                universes={universes}
                ordered={orderedUniverses}
                state={state}
                selectedNodeId={selectedNodeId}
                onNavigate={navigate}
                onOpenQuestion={openQuestion}
                onShowClues={() => setPanelTab('clues')}
              />
            ) : (
              <CluesPanel clues={clues} currentUniverseId={currentUniverse.id} onOpenQuestion={openQuestion} />
            )}
          </div>
        </aside>
      </main>

      {questionUniverse && question && (
        <QuestionDialog
          key={question.id}
          universe={questionUniverse}
          universes={universes}
          question={question}
          onAnswer={(answer) => {
            const result = game.answer(questionUniverse.id, question.id, answer);
            if (result.state.journal.slice(state.journal.length).some((entry) => entry.type === 'ending')) {
              setPendingEnding(true);
            }
            return result;
          }}
          onRead={(target) => {
            navigate(target);
            closeQuestion();
          }}
          onClose={closeQuestion}
        />
      )}

      {dialog === 'help' && (
        <WelcomeDialog
          firstTime={firstVisit}
          onClose={() => {
            setDialog(null);
            setFirstVisit(false);
          }}
        />
      )}

      {dialog === 'journal' && (
        <JournalDialog state={state} universes={universes} onNavigate={navigate} onClose={() => setDialog(null)} />
      )}

      {dialog === 'ending' && central.ending && (
        <EndingDialog
          title={central.ending.title}
          body={central.ending.body}
          onRestart={() => setDialog('reset')}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'reset' && (
        <ResetDialog
          onConfirm={() => {
            game.reset();
            setDialog(null);
            setSelectedNodeId(null);
            setPanelTab('story');
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
