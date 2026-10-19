import type { Universe } from '../domain/types';

interface UniverseSelectorProps {
  universes: Universe[];
  currentId: string;
  unseenIds: string[];
  onSelect: (universeId: string) => void;
}

export function UniverseSelector({ universes, currentId, unseenIds, onSelect }: UniverseSelectorProps) {
  return (
    <nav className="universe-selector" aria-label="Sélecteur d'univers">
      {universes.map((universe) => {
        const unseen = unseenIds.includes(universe.id) && universe.id !== currentId;
        const active = universe.id === currentId;
        return (
          <button
            key={universe.id}
            type="button"
            className={`universe-tab${active ? ' universe-tab--active' : ''}${universe.kind === 'meta' ? ' universe-tab--central' : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(universe.id)}
          >
            <span>{universe.name}</span>
            {unseen && (
              <span className="unseen-dot" role="img" aria-label="Nouvelle découverte non consultée" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
