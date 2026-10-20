import { useRef, useState, type FormEvent } from 'react';
import { GraphEdges, RevealedNode, VIEW_HEIGHT, VIEW_WIDTH } from '../components/graph';
import { KIND_OPTIONS } from '../components/labels';
import type { NodeKind, Universe } from '../domain/types';
import { sendContentEdits, type Commit, type CommitBatch, type ContentEdit } from './api';
import { nodeIdError } from './nodeRename';
import { NodeEditor } from './NodeEditor';
import { SelectField, TextField } from './SetupFields';

interface SetupScreenProps {
  universes: Universe[];
  initialUniverseId: string;
  onClose: () => void;
}

export function SetupScreen({ universes, initialUniverseId, onClose }: SetupScreenProps) {
  const [universeId, setUniverseId] = useState(initialUniverseId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newNodeOpen, setNewNodeOpen] = useState(false);
  const [status, setStatus] = useState('Chaque modification est écrite dans content/*.yaml.');
  const queue = useRef<Promise<void>>(Promise.resolve());

  const universe = universes.find((candidate) => candidate.id === universeId) ?? universes[0];
  if (!universe) return <p className="fatal">Aucun univers à éditer.</p>;

  const commitBatch: CommitBatch = (edits) => {
    queue.current = queue.current
      .then(() => {
        setStatus('Enregistrement…');
        return sendContentEdits(edits);
      })
      .then(() => setStatus('Enregistré dans content/*.yaml.'))
      .catch((error: unknown) => {
        setStatus(`Échec de l'enregistrement : ${error instanceof Error ? error.message : String(error)}`);
      });
  };

  const commit: Commit = (edit: ContentEdit) => commitBatch([{ ...edit, universeId: universe.id }]);

  const selectedNode = universe.nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="app setup">
      <header className="app-header">
        <div className="title-block">
          <h1>Setup</h1>
          <p className="counter" role="status">
            {status}
          </p>
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
          <SetupGraph universe={universe} selectedId={selectedNodeId} onSelect={setSelectedNodeId} />
        </section>

        <aside className="side-panel" aria-label="Panneau d'édition">
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
            />
          ) : (
            <p className="hint">Sélectionne un nœud dans le graphe pour éditer son lore, ses liens et ses questions.</p>
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

function NewNodeForm({ universes, universe, commit, onCreated }: NewNodeFormProps) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<NodeKind>('event');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nodeId = id.trim();
    const nodeTitle = title.trim();
    const idProblem = nodeIdError(universes, nodeId);
    if (idProblem) {
      setError(idProblem);
      return;
    }
    if (nodeTitle === '') {
      setError('Le titre est requis.');
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

  return (
    <form className="setup-card setup-new-node" onSubmit={submit} aria-label={`Nouveau nœud dans ${universe.name}`}>
      <label className="setup-field">
        <span>Identifiant</span>
        <input value={id} onChange={(event) => setId(event.target.value)} placeholder="ex. u1-lanterne" />
      </label>
      <label className="setup-field">
        <span>Titre</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <SelectField label="Type" value={kind} options={KIND_OPTIONS} onChange={(value) => setKind(value as NodeKind)} />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary">
        Créer le nœud
      </button>
    </form>
  );
}

interface SetupGraphProps {
  universe: Universe;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

function SetupGraph({ universe, selectedId, onSelect }: SetupGraphProps) {
  return (
    <div className="graph-wrapper">
      <svg className="graph" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="group" aria-label={`Graphe de ${universe.name}`}>
        <GraphEdges universe={universe} relations={universe.relations} selectedId={selectedId} />
        <g className="graph-nodes">
          {universe.nodes.map((node) => (
            <RevealedNode
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onSelect={() => onSelect(node.id)}
            />
          ))}
        </g>
      </svg>
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
      <h2>Univers</h2>
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
            value={universe.ending.body}
            onCommit={(value) => commit({ op: 'set', path: ['ending', 'body'], value })}
          />
        </>
      )}
    </section>
  );
}
