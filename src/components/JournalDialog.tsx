import type { UniverseMap } from '../domain/progression';
import type { GameState, JournalEntry, NodeRef } from '../domain/types';
import { Dialog } from './Dialog';

interface JournalDialogProps {
  state: GameState;
  universes: UniverseMap;
  onNavigate: (target: NodeRef) => void;
  onClose: () => void;
}

export function JournalDialog({ state, universes, onNavigate, onClose }: JournalDialogProps) {
  const universeName = (id: string) => universes[id]?.name ?? id;
  const entries = state.journal.map((entry, index) => ({ entry, index })).reverse();
  const discoveries = state.journal.filter((entry) => entry.type === 'reveal').length;

  const describe = (entry: JournalEntry) => {
    switch (entry.type) {
      case 'reveal': {
        const title = universes[entry.universeId]?.nodeById.get(entry.nodeId)?.title ?? '';
        return (
          <button
            type="button"
            className="ref-button"
            onClick={() => onNavigate({ universeId: entry.universeId, nodeId: entry.nodeId })}
          >
            <span className="journal-icon" aria-hidden="true">
              ✦
            </span>
            <span>
              <span className="ref-universe">{universeName(entry.universeId)}</span> {title}
            </span>
          </button>
        );
      }
      case 'visit':
        return (
          <span className="journal-plain">
            <span className="journal-icon" aria-hidden="true">
              ↦
            </span>
            Arrivée dans {universeName(entry.universeId)}
          </span>
        );
      case 'ending':
        return (
          <span className="journal-plain journal-ending">
            <span className="journal-icon" aria-hidden="true">
              ★
            </span>
            {universes[entry.universeId]?.ending?.title ?? 'Mission terminée'}
          </span>
        );
    }
  };

  return (
    <Dialog title="Carnet d'arpentage" eyebrow="Journal" wide onClose={onClose}>
      <div className="journal-stats">
        <p>
          <strong>{state.visited.length}</strong>
          <span>univers visités sur {Object.keys(universes).length}</span>
        </p>
        <p>
          <strong>{state.answeredQuestions.length}</strong>
          <span>questions résolues</span>
        </p>
        <p>
          <strong>{discoveries}</strong>
          <span>découvertes</span>
        </p>
      </div>
      <ol className="journal">
        {entries.map(({ entry, index }) => (
          <li key={index}>{describe(entry)}</li>
        ))}
      </ol>
    </Dialog>
  );
}
