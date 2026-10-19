import { useMemo } from 'react';
import { isRevealed } from '../domain/progression';
import type { UniverseMap } from '../domain/progression';
import { neighbourIds } from '../domain/universe';
import { computeVisibility } from '../domain/visibility';
import type { GameState, NodeKind, Universe } from '../domain/types';

const KIND_LABELS: Record<NodeKind, string> = {
  character: 'Personnage',
  place: 'Lieu',
  event: 'Événement',
};

interface SidePanelProps {
  universe: Universe;
  universes: UniverseMap;
  state: GameState;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}

export function SidePanel({ universe, universes, state, selectedNodeId, onSelect }: SidePanelProps) {
  const visibility = useMemo(
    () => computeVisibility(universe, new Set(state.revealed[universe.id] ?? [])),
    [universe, state.revealed],
  );
  const selected = selectedNodeId ? universe.nodeById.get(selectedNodeId) : undefined;
  const readable = selected && visibility.get(selected.id) === 'revealed' ? selected : undefined;

  return (
    <aside className="side-panel" aria-label="Panneau de lecture">
      {readable ? (
        <article className="reading">
          <p className="kind">{KIND_LABELS[readable.kind]}</p>
          <h2>{readable.title}</h2>
          <p className="intro">{readable.intro}</p>

          {readable.sections.map((section) => {
            const unlocked = state.unlockedSections.includes(section.id);
            if (unlocked) {
              return (
                <section key={section.id} className="section">
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                </section>
              );
            }
            if (section.unlockedByQuestionId) {
              return (
                <p key={section.id} className="locked">
                  Récit verrouillé : une enquête le déblocera.
                </p>
              );
            }
            return null;
          })}

          <RelationList
            universe={universe}
            nodeId={readable.id}
            visibility={visibility}
            onSelect={onSelect}
          />
          <EchoList universe={universe} nodeId={readable.id} universes={universes} state={state} />
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

function EchoList({
  universe,
  nodeId,
  universes,
  state,
}: {
  universe: Universe;
  nodeId: string;
  universes: UniverseMap;
  state: GameState;
}) {
  const findTarget = (targetNodeId: string) =>
    Object.values(universes).find((candidate) => candidate.nodeById.has(targetNodeId));

  const visibleEchoes = universe.echoes.filter((echo) => {
    if (echo.sourceNodeId !== nodeId) return false;
    const target = findTarget(echo.targetNodeId);
    return target !== undefined && isRevealed(state, target.id, echo.targetNodeId);
  });
  if (visibleEchoes.length === 0) return null;

  return (
    <section className="echoes">
      <h3>Échos</h3>
      <ul>
        {visibleEchoes.map((echo) => {
          const target = findTarget(echo.targetNodeId);
          const targetNode = target?.nodeById.get(echo.targetNodeId);
          return (
            <li key={echo.id}>
              {targetNode?.title} — {target?.name}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
