import { availableQuestions, universeProgress } from '../domain/progression';
import type { GameState, Universe } from '../domain/types';

interface UniverseNavProps {
  universes: Universe[];
  state: GameState;
  onSelect: (universeId: string) => void;
}

export function UniverseNav({ universes, state, onSelect }: UniverseNavProps) {
  return (
    <nav className="universe-nav" aria-label="Univers">
      <p className="nav-title">Univers</p>
      <ul>
        {universes.map((universe) => {
          const active = universe.id === state.currentUniverseId;
          const unseen = !active && state.unseen.includes(universe.id);
          const visited = state.visited.includes(universe.id);
          const { revealed, total } = universeProgress(state, universe);
          const clues = availableQuestions(state, universe).length;
          const classes = ['universe-card'];
          if (active) classes.push('universe-card--active');
          if (universe.kind === 'meta') classes.push('universe-card--central');

          return (
            <li key={universe.id}>
              <button
                type="button"
                className={classes.join(' ')}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(universe.id)}
              >
                <span className="universe-card-head">
                  <span className="universe-card-name">{universe.name}</span>
                  {unseen && <span className="unseen-dot" role="img" aria-label="Nouvelles découvertes" />}
                </span>
                <span className="universe-card-meta">
                  {universe.kind === 'meta' ? 'Mission' : visited ? 'Exploré' : 'Jamais visité'} · {revealed}/{total}
                  {clues > 0 && (
                    <span className="clue-badge" aria-label={`${clues} piste${clues > 1 ? 's' : ''} ouverte${clues > 1 ? 's' : ''}`}>
                      ? {clues}
                    </span>
                  )}
                </span>
                <span className="mini-progress" aria-hidden="true">
                  <span style={{ width: `${(revealed / Math.max(total, 1)) * 100}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
