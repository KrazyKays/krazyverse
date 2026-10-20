import type { UniverseMap } from '../domain/progression';
import type { GameState, JournalEntry } from '../domain/types';
import { Dialog } from './Dialog';

interface JournalDialogProps {
  state: GameState;
  universes: UniverseMap;
  onClose: () => void;
}

export function JournalDialog({ state, universes, onClose }: JournalDialogProps) {
  const universeName = (id: string) => universes[id]?.name ?? id;
  const nodeTitle = (universeId: string, nodeId: string) => universes[universeId]?.nodeById.get(nodeId)?.title ?? '';
  const findUniverseOf = (nodeId: string) =>
    Object.values(universes).find((universe) => universe.nodeById.has(nodeId));

  const describe = (entry: JournalEntry): string => {
    switch (entry.type) {
      case 'reveal':
        return `Découverte : ${nodeTitle(entry.universeId, entry.nodeId)} (${universeName(entry.universeId)})`;
      case 'echo': {
        const source = findUniverseOf(entry.sourceNodeId);
        const sourceTitle = source?.nodeById.get(entry.sourceNodeId)?.title ?? '';
        return `Écho : ${nodeTitle(entry.universeId, entry.nodeId)} (${universeName(entry.universeId)}), depuis ${sourceTitle}`;
      }
      case 'section': {
        const section = universes[entry.universeId]?.nodeById.get(entry.nodeId)?.sections.find(
          (candidate) => candidate.id === entry.sectionId,
        );
        return `Récit débloqué : ${section?.title ?? ''} — ${nodeTitle(entry.universeId, entry.nodeId)}`;
      }
      case 'visit':
        return `Univers visité : ${universeName(entry.universeId)}`;
      case 'ending': {
        const title = universes[entry.universeId]?.ending?.title ?? '';
        return `Conclusion : ${title}`;
      }
    }
  };

  const entries = [...state.journal].reverse();

  return (
    <Dialog title="Journal de découvertes" onClose={onClose}>
      <p className="hint">
        Univers visités : {state.visited.length} sur {Object.keys(universes).length}. Questions résolues :{' '}
        {state.answeredQuestions.length}.
      </p>
      {entries.length === 0 ? (
        <p className="hint">Aucune découverte pour l'instant.</p>
      ) : (
        <ol className="journal">
          {entries.map((entry, index) => (
            <li key={`${entry.type}-${index}`}>{describe(entry)}</li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
