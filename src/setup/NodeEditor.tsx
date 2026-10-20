import { useState } from 'react';
import type { NodeKind, Question, StoryNode, Universe } from '../domain/types';
import type { Commit, CommitBatch, ContentPath } from './api';
import { planNodeDeletion } from './nodeDeletion';
import { findHomologue, planNodeCopy } from './nodeCopy';
import { nodeIdError, planNodeRename } from './nodeRename';
import { CheckboxField, SelectField, TextField } from './SetupFields';

const KIND_LABELS: Record<NodeKind, string> = {
  character: 'Personnage',
  place: 'Lieu',
  event: 'Événement',
};

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as NodeKind[]).map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind],
}));

const ACCESS_OPTIONS = [
  { value: 'adjacent', label: 'Adjacente' },
  { value: 'enquete', label: 'Question centrale' },
];

interface NodeEditorProps {
  universe: Universe;
  universes: Universe[];
  node: StoryNode;
  commit: Commit;
  commitBatch: CommitBatch;
  onSelect: (nodeId: string) => void;
  onDeleted: () => void;
}

export function NodeEditor({ universe, universes, node, commit, commitBatch, onSelect, onDeleted }: NodeEditorProps) {
  const at = (...rest: ContentPath): ContentPath => ['nodes', { id: node.id }, ...rest];
  const setFlag = (key: 'revealedAtStart' | 'finale', checked: boolean) =>
    commit(checked ? { op: 'set', path: at(key), value: true } : { op: 'delete', path: at(key) });
  const questions = universe.questions.filter((question) => question.targetNodeId === node.id);
  const relations = universe.relations.filter((relation) => relation.from === node.id || relation.to === node.id);
  const copyTargets = universes.filter((candidate) => candidate.id !== universe.id);
  const [copyTargetId, setCopyTargetId] = useState(copyTargets[0]?.id ?? '');
  const copyTarget = copyTargets.find((candidate) => candidate.id === copyTargetId);
  const copyBlocked = copyTarget ? findHomologue(copyTarget, node) : undefined;

  const copyNode = () => {
    if (!copyTarget) return;
    const plan = planNodeCopy(universes, universe.id, node.id, copyTarget.id);
    const { questions: questionCount, relations: relationCount, skippedLinks } = plan.counts;
    const message = [
      `Copier « ${node.title} » dans ${copyTarget.name} ?`,
      `Nouvel identifiant : ${plan.newNodeId}`,
      `Copie ${questionCount} question(s) et ${relationCount} lien(s).`,
      skippedLinks > 0 ? `${skippedLinks} lien(s) ignoré(s) : pas d'homologue dans cet univers.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (!window.confirm(message)) return;
    commitBatch(plan.edits);
  };

  const deleteNode = () => {
    const plan = planNodeDeletion(universes, universe.id, node.id);
    const { relations: relationCount, questions: questionCount, requirements, reveals } = plan.counts;
    const message = [
      `Supprimer « ${node.title} » ?`,
      `Supprime ${relationCount} lien(s) et ${questionCount} question(s).`,
      requirements > 0 ? `Retire ce nœud des prérequis de ${requirements} question(s).` : '',
      reveals > 0 ? `Retire ce nœud des révélations de ${reveals} question(s).` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (!window.confirm(message)) return;
    commitBatch(plan.edits);
    onDeleted();
  };

  const renameNode = (newId: string) => {
    commitBatch(planNodeRename(universes, universe.id, node.id, newId));
    onSelect(newId);
  };

  const startState = node.revealedAtStart
    ? 'révélé dès le départ'
    : 'caché, apparaît quand un voisin est révélé, mais apparaît censuré si une question est renseignée';

  return (
    <section className="setup-card" aria-label={`Nœud ${node.title}`}>
      <p className="kind">{KIND_LABELS[node.kind]}</p>
      <NodeIdField nodeId={node.id} universes={universes} onRename={renameNode} />
      <TextField label="Titre" value={node.title} onCommit={(value) => commit({ op: 'set', path: at('title'), value })} />
      <SelectField
        label="Type"
        value={node.kind}
        options={KIND_OPTIONS}
        onChange={(value) => commit({ op: 'set', path: at('kind'), value })}
      />
      <div className="setup-row">
        <TextField
          type="number"
          label="Position X"
          value={String(node.position.x)}
          onCommit={(value) => commit({ op: 'set', path: at('position', 'x'), value: Number(value) })}
        />
        <TextField
          type="number"
          label="Position Y"
          value={String(node.position.y)}
          onCommit={(value) => commit({ op: 'set', path: at('position', 'y'), value: Number(value) })}
        />
      </div>
      <TextField
        label="Clé d'homologue"
        value={node.homologueKey}
        onCommit={(value) => commit({ op: 'set', path: at('homologueKey'), value })}
      />
      <TextField
        label="Introduction"
        multiline
        value={node.intro}
        onCommit={(value) => commit({ op: 'set', path: at('intro'), value })}
      />
      <h3>États</h3>
      <p className="hint">
        État au départ : <strong>{startState}</strong>
      </p>
      <CheckboxField
        label="Révélé au départ"
        checked={node.revealedAtStart === true}
        onChange={(checked) => setFlag('revealedAtStart', checked)}
      />
      <p className="hint">Le nœud est accessible dès le début.</p>
      <CheckboxField label="Nœud final" checked={node.finale === true} onChange={(checked) => setFlag('finale', checked)} />
      <p className="hint">Le révéler termine la question centrale. Sans effet sur la fin de partie hors de l'univers central.</p>
      {universe.kind === 'meta' && (
        <>
          <CheckboxField
            label="Requis pour la question centrale"
            checked={node.central?.required === true}
            onChange={(checked) => commit({ op: 'set', path: at('central', 'required'), value: checked })}
          />
          <p className="hint">Compte dans le décompte « nœuds restants » de la question centrale. Ne bloque pas la conclusion.</p>
        </>
      )}

      <h3>Liens</h3>
      {relations.length === 0 && <p className="hint">Aucun lien.</p>}
      <ul className="setup-list">
        {relations.map((relation) => {
          const otherId = relation.from === node.id ? relation.to : relation.from;
          const other = universe.nodeById.get(otherId);
          return (
            <li key={relation.id} className="setup-link">
              <button type="button" className="link" onClick={() => onSelect(otherId)}>
                {other?.title ?? otherId}
              </button>
              <button
                type="button"
                className="danger"
                aria-label={`Supprimer le lien avec ${other?.title ?? otherId}`}
                onClick={() => commit({ op: 'delete', path: ['relations', { id: relation.id }] })}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <LinkAdder universe={universe} node={node} commit={commit} />

      <h3>Questions</h3>
      {questions.length === 0 && <p className="hint">Aucune question sur ce nœud.</p>}
      {questions.map((question) => (
        <QuestionEditor
          key={question.id}
          universe={universe}
          universes={universes}
          question={question}
          commit={commit}
        />
      ))}
      <button
        type="button"
        onClick={() =>
          commit({
            op: 'push',
            path: ['questions'],
            value: {
              id: newQuestionId(universes, node),
              targetNodeId: node.id,
              access: 'adjacent',
              requiresRevealed: [],
              context: '',
              prompt: 'Nouvelle question',
              answers: ['Nouvelle réponse'],
              wrongFeedback: '',
            },
          })
        }
      >
        Ajouter une question
      </button>

      <h3>Copie</h3>
      <SelectField
        label="Copier vers l'univers"
        value={copyTargetId}
        options={copyTargets.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
        onChange={setCopyTargetId}
      />
      {copyBlocked && (
        <p className="hint">
          Un homologue existe déjà dans {copyTarget?.name} : « {copyBlocked.title} ».
        </p>
      )}
      <button type="button" disabled={!copyTarget || copyBlocked !== undefined} onClick={copyNode}>
        Copier le nœud
      </button>

      <h3>Danger</h3>
      <button type="button" className="danger" onClick={deleteNode}>
        Supprimer le nœud
      </button>
    </section>
  );
}

interface NodeIdFieldProps {
  nodeId: string;
  universes: Universe[];
  onRename: (newId: string) => void;
}

function NodeIdField({ nodeId, universes, onRename }: NodeIdFieldProps) {
  const [draft, setDraft] = useState(nodeId);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const next = draft.trim();
    if (next === nodeId) {
      setDraft(nodeId);
      setError(null);
      return;
    }
    const problem = nodeIdError(universes, next);
    if (problem) {
      setError(problem);
      return;
    }
    if (!window.confirm(`Renommer « ${nodeId} » en « ${next} » ? Les liens et questions qui le citent seront mis à jour.`)) {
      setDraft(nodeId);
      setError(null);
      return;
    }
    setError(null);
    onRename(next);
  };

  return (
    <>
      <label className="setup-field">
        <span>Identifiant</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

interface LinkAdderProps {
  universe: Universe;
  node: StoryNode;
  commit: Commit;
}

function LinkAdder({ universe, node, commit }: LinkAdderProps) {
  const [target, setTarget] = useState('');
  const linked = new Set(
    universe.relations.flatMap((relation) => (relation.from === node.id || relation.to === node.id ? [relation.from, relation.to] : [])),
  );
  const candidates = universe.nodes.filter((candidate) => candidate.id !== node.id && !linked.has(candidate.id));

  const addLink = () => {
    if (target === '') return;
    commit({
      op: 'push',
      path: ['relations'],
      value: { id: newRelationId(universe, node.id, target), from: node.id, to: target },
    });
    setTarget('');
  };

  if (candidates.length === 0) return null;

  return (
    <div className="setup-row">
      <SelectField
        label="Ajouter un lien vers"
        value={target}
        options={[{ value: '', label: 'Choisir un nœud…' }, ...candidates.map((candidate) => ({ value: candidate.id, label: candidate.title }))]}
        onChange={setTarget}
      />
      <button type="button" disabled={target === ''} onClick={addLink}>
        Lier
      </button>
    </div>
  );
}

type RevealField = 'requiresRevealed' | 'alsoRevealed';

interface QuestionEditorProps {
  universe: Universe;
  universes: Universe[];
  question: Question;
  commit: Commit;
}

function QuestionEditor({ universe, universes, question, commit }: QuestionEditorProps) {
  const at = (...rest: ContentPath): ContentPath => ['questions', { id: question.id }, ...rest];
  const toggleRevealed = (field: RevealField, nodeId: string, checked: boolean) => {
    const current = question[field] ?? [];
    const next = checked ? [...current, nodeId] : current.filter((id) => id !== nodeId);
    commit({ op: 'set', path: at(field), value: next });
  };
  const revealChecklist = (field: RevealField) => (
    <div className="setup-checks">
      {universes.map((candidate) => (
        <div key={candidate.id}>
          <p className="hint">{candidate.name}</p>
          {candidate.nodes.map((node) => (
            <CheckboxField
              key={node.id}
              label={node.title}
              checked={(question[field] ?? []).includes(node.id)}
              onChange={(checked) => toggleRevealed(field, node.id, checked)}
            />
          ))}
        </div>
      ))}
    </div>
  );
  const nodeOptions = universe.nodes.map((node) => ({ value: node.id, label: node.title }));

  const deleteQuestion = () => {
    if (!window.confirm(`Supprimer la question « ${question.id} » ?`)) return;
    commit({ op: 'delete', path: ['questions', { id: question.id }] });
  };

  return (
    <article className="setup-subcard" aria-label={`Question ${question.id}`}>
      <p className="hint">
        <code>{question.id}</code>
      </p>
      <SelectField
        label="Nœud ciblé"
        value={question.targetNodeId}
        options={nodeOptions}
        onChange={(value) => commit({ op: 'set', path: at('targetNodeId'), value })}
      />
      <SelectField
        label="Accès"
        value={question.access}
        options={ACCESS_OPTIONS}
        onChange={(value) => commit({ op: 'set', path: at('access'), value })}
      />
      <TextField
        label="Contexte"
        multiline
        value={question.context}
        onCommit={(value) => commit({ op: 'set', path: at('context'), value })}
      />
      <TextField
        label="Question"
        multiline
        value={question.prompt}
        onCommit={(value) => commit({ op: 'set', path: at('prompt'), value })}
      />
      <details>
        <summary>Nœuds à révéler avant ({question.requiresRevealed.length})</summary>
        {revealChecklist('requiresRevealed')}
      </details>
      <details>
        <summary>Nœuds à révéler avec la réponse ({question.alsoRevealed?.length ?? 0})</summary>
        {revealChecklist('alsoRevealed')}
      </details>

      <p className="hint">Réponses acceptées</p>
      {question.answers.map((answer, answerIndex) => (
        <div key={answerIndex} className="setup-row">
          <TextField
            label={`Réponse ${answerIndex + 1}`}
            value={answer}
            onCommit={(value) => {
              if (value.trim() !== '') commit({ op: 'set', path: at('answers', answerIndex), value });
            }}
          />
          <button
            type="button"
            className="danger"
            disabled={question.answers.length <= 1}
            aria-label={`Supprimer la réponse ${answerIndex + 1}`}
            onClick={() => commit({ op: 'delete', path: at('answers', answerIndex) })}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => commit({ op: 'push', path: at('answers'), value: 'Nouvelle réponse' })}>
        Ajouter une réponse
      </button>

      <TextField
        label="Retour en cas d'erreur"
        multiline
        value={question.wrongFeedback}
        onCommit={(value) => commit({ op: 'set', path: at('wrongFeedback'), value })}
      />

      <button type="button" className="danger" onClick={deleteQuestion}>
        Supprimer la question
      </button>
    </article>
  );
}

function newQuestionId(universes: Universe[], node: StoryNode): string {
  const taken = new Set(universes.flatMap((candidate) => candidate.questions.map((question) => question.id)));
  const base = `q-${node.id}`;
  let id = base;
  let index = 2;
  while (taken.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function newRelationId(universe: Universe, from: string, to: string): string {
  const taken = new Set(universe.relations.map((relation) => relation.id));
  const base = `link-${from}-${to}`;
  let id = base;
  let index = 2;
  while (taken.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}
