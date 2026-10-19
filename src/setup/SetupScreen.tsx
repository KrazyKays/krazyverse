import { useRef, useState, type FormEvent } from 'react';
import { NodeShape } from '../components/UniverseGraph';
import type { NodeKind, Universe } from '../domain/types';
import { sendContentEdits, type Commit, type CommitBatch, type ContentEdit } from './api';
import { KIND_OPTIONS, NodeEditor } from './NodeEditor';
import { SelectField, TextField } from './SetupFields';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 720;

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

      <div className="setup-layout">
        <div className="setup-graph">
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
          <section aria-label="Graphe des nœuds">
            <SetupGraph universe={universe} selectedId={selectedNodeId} onSelect={setSelectedNodeId} />
          </section>
        </div>

        <aside className="setup-editor">
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
      </div>
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
    if (!/^[a-z0-9][a-z0-9-]*$/.test(nodeId)) {
      setError('Identifiant requis : minuscules, chiffres et tirets.');
      return;
    }
    if (universes.some((candidate) => candidate.nodeById.has(nodeId))) {
      setError('Cet identifiant existe déjà.');
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
        sections: [],
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
        <g className="graph-edges">
          {universe.relations.map((relation) => {
            const from = universe.nodeById.get(relation.from)?.position;
            const to = universe.nodeById.get(relation.to)?.position;
            if (!from || !to) return null;
            const active = relation.from === selectedId || relation.to === selectedId;
            return (
              <line
                key={relation.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={active ? 'edge edge--active' : 'edge'}
              />
            );
          })}
        </g>
        <g className="graph-nodes">
          {universe.nodes.map((node) => {
            const selected = node.id === selectedId;
            const select = () => onSelect(node.id);
            return (
              <g
                key={node.id}
                className={`node node--revealed${selected ? ' node--selected' : ''}`}
                transform={`translate(${node.position.x} ${node.position.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={node.title}
                onClick={select}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select();
                  }
                }}
              >
                <NodeShape kind={node.kind} />
                <text className="node-label" textAnchor="middle" y={30}>
                  {node.title}
                </text>
              </g>
            );
          })}
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
