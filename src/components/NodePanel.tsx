import type { UniverseMap } from '../domain/progression';
import {
  availableQuestions,
  homologuesOf,
  isRevealed,
  missingRequirements,
  universeProgress,
} from '../domain/progression';
import { visibilityFor } from '../domain/visibility';
import type { GameState, NodeRef, Universe } from '../domain/types';
import { KIND_INDEFINITE, KIND_LABELS } from './labels';

interface NodePanelProps {
  universe: Universe;
  universes: UniverseMap;
  ordered: Universe[];
  state: GameState;
  selectedNodeId: string | null;
  onNavigate: (target: NodeRef) => void;
  onOpenQuestion: (universeId: string, questionId: string) => void;
  onShowClues: () => void;
}

export function NodePanel({
  universe,
  universes,
  ordered,
  state,
  selectedNodeId,
  onNavigate,
  onOpenQuestion,
  onShowClues,
}: NodePanelProps) {
  const node = selectedNodeId ? universe.nodeById.get(selectedNodeId) : undefined;
  const status = node ? visibilityFor(state, universe).get(node.id) : undefined;

  if (!node || status === 'hidden') {
    return <UniverseOverview universe={universe} state={state} onShowClues={onShowClues} />;
  }

  // Le titre d'un nœud voilé trahirait souvent la réponse : seul son type est montré.
  const nodeKind = (ref: NodeRef) => universes[ref.universeId]?.nodeById.get(ref.nodeId)?.kind ?? 'event';
  const universeName = (id: string) => universes[id]?.name ?? id;

  if (status === 'censored') {
    const questions = universe.questions.filter((question) => question.targetNodeId === node.id);
    const open = availableQuestions(state, universe).find((question) => question.targetNodeId === node.id);
    const missing = [
      ...new Map(
        questions.flatMap((question) => missingRequirements(state, universes, question)).map((ref) => [ref.nodeId, ref]),
      ).values(),
    ];

    return (
      <article className="reading reading--veiled">
        <p className="kind">Élément voilé</p>
        <h2>? ? ?</h2>
        {open ? (
          <>
            <p>Une question permet de lever le voile sur cet élément.</p>
            <button type="button" className="primary" onClick={() => onOpenQuestion(universe.id, open.id)}>
              Répondre à la question
            </button>
          </>
        ) : missing.length > 0 ? (
          <>
            <p>Cette piste s'ouvrira lorsque vous aurez découvert :</p>
            <ul className="ref-list">
              {missing.map((ref) => (
                <li key={`${ref.universeId}-${ref.nodeId}`}>
                  <span className="ref-universe">{universeName(ref.universeId)}</span>
                  <span>{KIND_INDEFINITE[nodeKind(ref)]} encore voilé</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Cet élément se révélera grâce à une découverte faite dans un autre univers.</p>
        )}
      </article>
    );
  }

  const homologues = homologuesOf(ordered, universe.id, node);

  return (
    <article className="reading" key={node.id}>
      <p className="kind">
        {KIND_LABELS[node.kind]} · {universe.name}
      </p>
      <h2>{node.title}</h2>
      <p className="intro">{node.intro || 'Le récit de cet élément reste à écrire.'}</p>

      {homologues.length > 0 && (
        <section className="homologues" aria-label="Dans les autres univers">
          <h3>Dans les autres univers</h3>
          <ul className="ref-list">
            {homologues.map(({ universe: other, node: twin }) => {
              const known = isRevealed(state, other.id, twin.id);
              return (
                <li key={other.id}>
                  {known ? (
                    <button
                      type="button"
                      className="ref-button"
                      onClick={() => onNavigate({ universeId: other.id, nodeId: twin.id })}
                    >
                      <span className="ref-universe">{other.name}</span>
                      <span>{twin.title}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <span className="ref-muted">
                      <span className="ref-universe">{other.name}</span>
                      <span>encore voilé</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}

interface UniverseOverviewProps {
  universe: Universe;
  state: GameState;
  onShowClues: () => void;
}

function UniverseOverview({ universe, state, onShowClues }: UniverseOverviewProps) {
  const { revealed, total } = universeProgress(state, universe);
  const clues = availableQuestions(state, universe).length;

  return (
    <article className="reading">
      <p className="kind">{universe.kind === 'meta' ? 'Univers central' : 'Univers de conte'}</p>
      <h2>{universe.name}</h2>
      <p className="intro">{universe.tagline}</p>
      <p className="stat">
        <strong>{revealed}</strong> élément{revealed > 1 ? 's' : ''} révélé{revealed > 1 ? 's' : ''} sur {total}
      </p>
      {clues > 0 ? (
        <button type="button" onClick={onShowClues}>
          {clues} piste{clues > 1 ? 's' : ''} ouverte{clues > 1 ? 's' : ''} ici
        </button>
      ) : (
        <p className="hint">Aucune piste ouverte ici pour l'instant.</p>
      )}
      <p className="hint">Cliquez sur un élément de la toile pour lire son récit.</p>
    </article>
  );
}
