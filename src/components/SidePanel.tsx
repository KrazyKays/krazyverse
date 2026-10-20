import { useEffect, useMemo, useRef } from 'react';
import { neighbourIds } from '../domain/universe';
import { computeVisibility } from '../domain/visibility';
import type { GameState, NodeKind, Universe } from '../domain/types';

export const KIND_LABELS: Record<NodeKind, string> = {
  character: 'Personnage',
  place: 'Lieu',
  event: 'Événement',
};

interface SidePanelProps {
  universe: Universe;
  state: GameState;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}

export function SidePanel({ universe, state, selectedNodeId, onSelect }: SidePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const visibility = useMemo(
    () => computeVisibility(universe, new Set(state.revealed[universe.id] ?? [])),
    [universe, state.revealed],
  );
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

          <RelationList
            universe={universe}
            nodeId={readable.id}
            visibility={visibility}
            onSelect={onSelect}
          />
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

function RelationList({
  universe,
  nodeId,
  visibility,
  onSelect,
}: {
  universe: Universe;
  nodeId: string;
  visibility: Map<string, string>;
  onSelect: (nodeId: string) => void;
}) {
  const relations = neighbourIds(universe, nodeId).filter((id) => visibility.get(id) !== 'hidden');
  if (relations.length === 0) return null;

  return (
    <section className="relations">
      <h3>Relations connues</h3>
      <ul>
        {relations.map((id) => {
          const other = universe.nodeById.get(id);
          if (!other) return null;
          if (visibility.get(id) === 'revealed') {
            return (
              <li key={id}>
                <button type="button" className="link" onClick={() => onSelect(id)}>
                  {other.title}
                </button>
              </li>
            );
          }
          return (
            <li key={id} className="censored-text">
              Nœud censuré
            </li>
          );
        })}
      </ul>
    </section>
  );
}
