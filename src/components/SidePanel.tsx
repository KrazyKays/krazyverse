import { useEffect, useMemo, useRef } from 'react';
import { visibilityFor } from '../domain/visibility';
import type { GameState, Universe } from '../domain/types';
import { KIND_LABELS } from './labels';

interface SidePanelProps {
  universe: Universe;
  state: GameState;
  selectedNodeId: string | null;
}

export function SidePanel({ universe, state, selectedNodeId }: SidePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const visibility = useMemo(() => visibilityFor(state, universe), [state, universe]);
  const selected = selectedNodeId ? universe.nodeById.get(selectedNodeId) : undefined;
  const readable = selected && visibility.get(selected.id) === 'revealed' ? selected : undefined;

  useEffect(() => {
    if (selectedNodeId === null || !window.matchMedia('(max-width: 860px)').matches) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [selectedNodeId]);

  return (
    <aside ref={panelRef} className="side-panel" aria-label="Panneau de lecture">
      {readable ? (
        <article className="reading">
          <p className="kind">{KIND_LABELS[readable.kind]}</p>
          <h2>{readable.title}</h2>
          <p className="intro">{readable.intro}</p>
        </article>
      ) : (
        <div className="reading reading--empty">
          <p className="kind">{universe.kind === 'meta' ? 'Univers central' : 'Univers de conte'}</p>
          <h2>{universe.name}</h2>
          <p className="intro">{universe.tagline}</p>
          <p className="hint">Sélectionne un nœud révélé pour lire son récit.</p>
        </div>
      )}
    </aside>
  );
}
