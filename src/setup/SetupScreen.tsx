import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { GraphEdges, GraphLegend, NodeShape, RevealedNode, VIEW_HEIGHT, VIEW_WIDTH } from '../components/graph';
import { KIND_OPTIONS } from '../components/labels';
import { unreachableNodeIds } from '../domain/visibility';
import type { NodeKind, Universe } from '../domain/types';
import { sendContentEdits, type Commit, type CommitBatch, type ContentEdit } from './api';
import { nodeIdError } from './nodeRename';
import { NodeEditor } from './NodeEditor';
import { Section, SelectField, TextField } from './SetupFields';

interface SetupScreenProps {
  universes: Universe[];
  initialUniverseId: string;
  onClose: () => void;
}

type StatusTone = 'idle' | 'saving' | 'saved' | 'error';

interface Status {
  tone: StatusTone;
  text: string;
}

export function SetupScreen({ universes, initialUniverseId, onClose }: SetupScreenProps) {
  const [universeId, setUniverseId] = useState(initialUniverseId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newNodeOpen, setNewNodeOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ tone: 'idle', text: 'Prêt' });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selectedNodeId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [role="dialog"]')) return;
      setSelectedNodeId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId === null || !window.matchMedia('(max-width: 860px)').matches) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [selectedNodeId]);

  const universe = universes.find((candidate) => candidate.id === universeId) ?? universes[0];
  if (!universe) return <p className="fatal">Aucun univers à éditer.</p>;

  const commitBatch: CommitBatch = (edits) => {
    queue.current = queue.current
      .then(() => {
        setStatus({ tone: 'saving', text: 'Enregistrement…' });
        return sendContentEdits(edits);
      })
      .then(() => setStatus({ tone: 'saved', text: 'Enregistré' }))
      .catch((error: unknown) => {
        setStatus({
          tone: 'error',
          text: `Échec de l'enregistrement : ${error instanceof Error ? error.message : String(error)}`,
        });
      });
  };

  const commit: Commit = (edit: ContentEdit) => commitBatch([{ ...edit, universeId: universe.id }]);

  const selectedNode = universe.nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="app setup">
      <header className="app-header">
        <div className="title-block">
          <h1>Setup</h1>
          <p
            className={`setup-status setup-status--${status.tone}`}
            role="status"
            aria-live={status.tone === 'error' ? 'assertive' : 'polite'}
          >
            {status.text}
          </p>
          <p className="counter">Chaque modification est écrite dans content/*.yaml. Entrée valide un champ, Échap l'annule.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onClose}>
            Retour au jeu
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="universe-selector" role="group" aria-label="Univers à éditer">
          {universes.map((candidate) => {
            const active = candidate.id === universe.id;
            return (
              <button
                key={candidate.id}
                type="button"
                className={active ? 'universe-tab universe-tab--active' : 'universe-tab'}
                aria-pressed={active}
                onClick={() => {
                  setUniverseId(candidate.id);
                  setSelectedNodeId(null);
                  setNewNodeOpen(false);
                }}
              >
                {candidate.name}
              </button>
            );
          })}
        </div>

        <section className="graph-area" aria-label="Graphe des nœuds">
          <button type="button" className="skip-link" onClick={() => panelRef.current?.focus()}>
            Aller au panneau d'édition
          </button>
          <SetupGraph
            universes={universes}
            universe={universe}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            onDeselect={() => setSelectedNodeId(null)}
          />
        </section>

        <aside ref={panelRef} tabIndex={-1} className="side-panel" aria-label="Panneau d'édition">
          <div className="setup-toolbar">
            <button type="button" onClick={() => setNewNodeOpen((open) => !open)} aria-expanded={newNodeOpen}>
              {newNodeOpen ? 'Annuler' : 'Ajouter un nœud'}
            </button>
          </div>
          {newNodeOpen && (
            <NewNodeForm
              universes={universes}
              universe={universe}
              commit={commit}
              onCreated={(nodeId) => {
                setSelectedNodeId(nodeId);
                setNewNodeOpen(false);
              }}
            />
          )}
          <UniverseFields key={universe.id} universe={universe} commit={commit} />
          {selectedNode ? (
            <NodeEditor
              key={selectedNode.id}
              universe={universe}
              universes={universes}
              node={selectedNode}
              commit={commit}
              commitBatch={commitBatch}
              onSelect={setSelectedNodeId}
              onDeleted={() => setSelectedNodeId(null)}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : (
            <p className="setup-empty">Sélectionne un nœud dans le graphe pour éditer son lore, ses liens et ses questions.</p>
          )}
        </aside>
      </main>
    </div>
  );
}

interface NewNodeFormProps {
  universes: Universe[];
  universe: Universe;
  commit: Commit;
  onCreated: (nodeId: string) => void;
}

interface FormError {
  field: 'id' | 'title';
  message: string;
}

function NewNodeForm({ universes, universe, commit, onCreated }: NewNodeFormProps) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<NodeKind>('event');
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nodeId = id.trim();
    const nodeTitle = title.trim();
    const idProblem = nodeIdError(universes, nodeId);
    if (idProblem) {
      setError({ field: 'id', message: idProblem });
      return;
    }
    if (nodeTitle === '') {
      setError({ field: 'title', message: 'Le titre est requis.' });
      return;
    }
    commit({
      op: 'push',
      path: ['nodes'],
      value: {
        id: nodeId,
        kind,
        title: nodeTitle,
        position: { x: 500, y: 360 },
        homologueKey: nodeId,
        intro: '',
      },
    });
    setId('');
    setTitle('');
    setError(null);
    onCreated(nodeId);
  };

  const describe = (field: FormError['field']) =>
    error?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};

  return (
    <form className="setup-card setup-new-node" onSubmit={submit} aria-label={`Nouveau nœud dans ${universe.name}`}>
      <label className="setup-field">
        <span>Identifiant</span>
        <input
          autoFocus
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="ex. u1-lanterne"
          {...describe('id')}
        />
      </label>
      <label className="setup-field">
        <span>Titre</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} {...describe('title')} />
      </label>
      <SelectField label="Type" value={kind} options={KIND_OPTIONS} onChange={(value) => setKind(value as NodeKind)} />
      <p className="hint">Le nœud est créé au centre du graphe : ajuste ensuite sa position X/Y.</p>
      {error && (
        <p id={errorId} className="notice" role="alert">
          {error.message}
        </p>
      )}
      <button type="submit" className="primary">
        Créer le nœud
      </button>
    </form>
  );
}

interface SetupGraphProps {
  universes: Universe[];
  universe: Universe;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  onDeselect: () => void;
}

function nodeBadge(universe: Universe, nodeId: string): string | undefined {
  const node = universe.nodeById.get(nodeId);
  const questionCount = universe.questions.filter((question) => question.targetNodeId === nodeId).length;
  const parts = [
    node?.revealedAtStart ? '▸' : '',
    node?.finale ? '★' : '',
    questionCount > 0 ? `?${questionCount}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function SetupGraph({ universes, universe, selectedId, onSelect, onDeselect }: SetupGraphProps) {
  const unreachable = unreachableNodeIds(universes, universe);
  const onBackgroundClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('.node')) return;
    onDeselect();
  };

  return (
    <div className="graph-wrapper">
      <svg
        className="graph"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="group"
        aria-label={`Graphe de ${universe.name}`}
        onClick={onBackgroundClick}
      >
        <GraphEdges universe={universe} relations={universe.relations} selectedId={selectedId} />
        <g className="graph-nodes">
          {universe.nodes.map((node) => (
            <RevealedNode
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              unreachable={unreachable.has(node.id)}
              badge={nodeBadge(universe, node.id)}
              onSelect={() => onSelect(node.id)}
            />
          ))}
        </g>
      </svg>
      <GraphLegend
        censored={false}
        extra={
          <>
            <li>▸ révélé au départ</li>
            <li>★ nœud final</li>
            <li>?n questions</li>
            <li>
              <svg className="legend-icon" viewBox="-16 -16 32 32" aria-hidden="true">
                <g className="node node--unreachable">
                  <NodeShape kind="event" />
                </g>
              </svg>
              jamais révélable (ni question, ni révélation)
            </li>
          </>
        }
      />
    </div>
  );
}

interface UniverseFieldsProps {
  universe: Universe;
  commit: Commit;
}

function UniverseFields({ universe, commit }: UniverseFieldsProps) {
  return (
    <section className="setup-card" aria-label="Univers">
      <Section title={`Univers : ${universe.name}`} level={2} defaultOpen={false}>
        <TextField label="Nom" value={universe.name} onCommit={(value) => commit({ op: 'set', path: ['name'], value })} />
        <TextField
          label="Accroche"
          multiline
          value={universe.tagline}
          onCommit={(value) => commit({ op: 'set', path: ['tagline'], value })}
        />
        {universe.ending && (
          <>
            <TextField
              label="Titre de la conclusion"
              value={universe.ending.title}
              onCommit={(value) => commit({ op: 'set', path: ['ending', 'title'], value })}
            />
            <TextField
              label="Texte de la conclusion"
              multiline
              rows={6}
              value={universe.ending.body}
              onCommit={(value) => commit({ op: 'set', path: ['ending', 'body'], value })}
            />
          </>
        )}
      </Section>
    </section>
  );
}
