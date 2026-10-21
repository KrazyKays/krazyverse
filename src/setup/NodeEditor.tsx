import { useId, useState } from 'react';
import type { Question, StoryNode, Universe } from '../domain/types';
import { KIND_LABELS, KIND_OPTIONS } from '../components/labels';
import type { Commit, CommitBatch, ContentPath } from './api';
import type { ConfirmRequest } from './ConfirmDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { uniqueId } from './ids';
import { planNodeDeletion } from './nodeDeletion';
import { findHomologue, planNodeCopy } from './nodeCopy';
import { nodeIdError, planNodeRename } from './nodeRename';
import { CheckboxField, Section, SelectField, TextField } from './SetupFields';

const ACCESS_OPTIONS = [
  { value: 'adjacent', label: 'Adjacente' },
  { value: 'enquete', label: 'Question centrale' },
];

const QUESTION_TITLE_LENGTH = 70;

interface NodeEditorProps {
  universe: Universe;
  universes: Universe[];
  node: StoryNode;
  commit: Commit;
  commitBatch: CommitBatch;
  onSelect: (nodeId: string) => void;
  onDeleted: () => void;
  onClose: () => void;
}

export function NodeEditor({ universe, universes, node, commit, commitBatch, onSelect, onDeleted, onClose }: NodeEditorProps) {
  const at = (...rest: ContentPath): ContentPath => ['nodes', { id: node.id }, ...rest];
  const setFlag = (key: 'revealedAtStart' | 'finale', checked: boolean) =>
    commit(checked ? { op: 'set', path: at(key), value: true } : { op: 'delete', path: at(key) });
  const questions = universe.questions.filter((question) => question.targetNodeId === node.id);
  const relations = universe.relations.filter((relation) => relation.from === node.id || relation.to === node.id);
  const copyTargets = universes.filter((candidate) => candidate.id !== universe.id);
  const [copyTargetId, setCopyTargetId] = useState(copyTargets[0]?.id ?? '');
  const copyTarget = copyTargets.find((candidate) => candidate.id === copyTargetId);
  const copyBlocked = copyTarget ? findHomologue(copyTarget, node) : undefined;
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const copyNode = () => {
    if (!copyTarget) return;
    const plan = planNodeCopy(universes, universe.id, node.id, copyTarget.id);
    const { questions: questionCount, relations: relationCount, skippedLinks } = plan.counts;
    setConfirmRequest({
      title: `Copier « ${node.title} »`,
      lines: [
        `Destination : ${copyTarget.name}`,
        `Nouvel identifiant : ${plan.newNodeId}`,
        `Copie ${questionCount} question(s) et ${relationCount} lien(s).`,
        skippedLinks > 0 ? `${skippedLinks} lien(s) ignoré(s) : pas d'homologue dans cet univers.` : '',
      ].filter(Boolean),
      confirmLabel: 'Copier',
      onConfirm: () => commitBatch(plan.edits),
    });
  };

  const deleteNode = () => {
    const plan = planNodeDeletion(universes, universe.id, node.id);
    const { relations: relationCount, questions: questionCount, requirements, reveals } = plan.counts;
    setConfirmRequest({
      title: `Supprimer « ${node.title} »`,
      lines: [
        `Supprime ${relationCount} lien(s) et ${questionCount} question(s).`,
        requirements > 0 ? `Retire ce nœud des prérequis de ${requirements} question(s).` : '',
        reveals > 0 ? `Retire ce nœud des révélations de ${reveals} question(s).` : '',
      ].filter(Boolean),
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: () => {
        commitBatch(plan.edits);
        onDeleted();
      },
    });
  };

  const renameNode = (newId: string) => {
    commitBatch(planNodeRename(universes, universe.id, node.id, newId));
    onSelect(newId);
  };

  const addQuestion = () => {
    const id = newQuestionId(universes, node);
    setFocusTarget(`question:${id}`);
    commit({
      op: 'push',
      path: ['questions'],
      value: {
        id,
        targetNodeId: node.id,
        access: 'adjacent',
        requiresRevealed: [],
        context: '',
        prompt: 'Nouvelle question',
        answers: ['Nouvelle réponse'],
        wrongFeedback: '',
      },
    });
  };

  return (
    <section className="setup-card" aria-label={`Nœud ${node.title}`}>
      <header className="setup-node-header">
        <div>
          <p className="kind">{KIND_LABELS[node.kind]}</p>
          <h2>{node.title || node.id}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Fermer l'éditeur de nœud" onClick={onClose}>
          ×
        </button>
      </header>

      <TextField label="Titre" value={node.title} onCommit={(value) => commit({ op: 'set', path: at('title'), value })} />
      <SelectField
        label="Type"
        value={node.kind}
        options={KIND_OPTIONS}
        onChange={(value) => commit({ op: 'set', path: at('kind'), value })}
      />
      <TextField
        label="Introduction"
        multiline
        rows={6}
        value={node.intro}
        onCommit={(value) => commit({ op: 'set', path: at('intro'), value })}
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

      <Section title="Technique" defaultOpen={false}>
        <NodeIdField nodeId={node.id} universes={universes} onRename={renameNode} askConfirm={setConfirmRequest} />
        <TextField
          label="Clé d'homologue"
          value={node.homologueKey}
          onCommit={(value) => commit({ op: 'set', path: at('homologueKey'), value })}
        />
      </Section>

      <Section title="États">
        <CheckboxField
          label="Révélé au départ"
          description="Visible dès le début de la partie. Sinon le nœud reste caché jusqu'à la révélation d'un voisin, puis apparaît censuré tant qu'une question le cible."
          checked={node.revealedAtStart === true}
          onChange={(checked) => setFlag('revealedAtStart', checked)}
        />
        <CheckboxField
          label="Nœud final"
          description="Le révéler termine la question centrale. Sans effet sur la fin de partie hors de l'univers central."
          checked={node.finale === true}
          onChange={(checked) => setFlag('finale', checked)}
        />
        {universe.kind === 'meta' && (
          <CheckboxField
            label="Requis pour la question centrale"
            description="Compte dans le décompte « nœuds restants » de la question centrale. Ne bloque pas la conclusion."
            checked={node.central?.required === true}
            onChange={(checked) => commit({ op: 'set', path: at('central', 'required'), value: checked })}
          />
        )}
      </Section>

      <Section title="Liens" count={relations.length}>
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
                  className="danger icon-button"
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
      </Section>

      <Section title="Questions" count={questions.length}>
        {questions.length === 0 && <p className="hint">Aucune question sur ce nœud.</p>}
        {questions.map((question) => (
          <QuestionEditor
            key={question.id}
            universe={universe}
            universes={universes}
            question={question}
            single={questions.length === 1}
            focusTarget={focusTarget}
            onRequestFocus={setFocusTarget}
            askConfirm={setConfirmRequest}
            commit={commit}
          />
        ))}
        <button type="button" onClick={addQuestion}>
          Ajouter une question
        </button>
      </Section>

      <Section title="Copie" defaultOpen={false}>
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
      </Section>

      <Section title="Danger" tone="danger" defaultOpen={false}>
        <button type="button" className="danger" onClick={deleteNode}>
          Supprimer le nœud
        </button>
      </Section>

      {confirmRequest && <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </section>
  );
}

interface NodeIdFieldProps {
  nodeId: string;
  universes: Universe[];
  onRename: (newId: string) => void;
  askConfirm: (request: ConfirmRequest) => void;
}

function NodeIdField({ nodeId, universes, onRename, askConfirm }: NodeIdFieldProps) {
  const [draft, setDraft] = useState(nodeId);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const submit = () => {
    const next = draft.trim();
    if (next === nodeId) {
      setError(null);
      return;
    }
    const problem = nodeIdError(universes, next);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    askConfirm({
      title: 'Renommer le nœud',
      lines: [`Renommer « ${nodeId} » en « ${next} » ?`, 'Les liens et questions qui le citent seront mis à jour.'],
      confirmLabel: 'Renommer',
      onConfirm: () => onRename(next),
      onCancel: () => setDraft(nodeId),
    });
  };

  return (
    <>
      <div className="setup-row">
        <label className="setup-field">
          <span>Identifiant</span>
          <input
            value={draft}
            aria-invalid={error !== null || undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(nodeId);
                setError(null);
              }
            }}
          />
        </label>
        <button type="button" disabled={draft.trim() === nodeId} onClick={submit}>
          Renommer
        </button>
      </div>
      {error && (
        <p id={errorId} className="notice" role="alert">
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
  single: boolean;
  focusTarget: string | null;
  onRequestFocus: (target: string) => void;
  askConfirm: (request: ConfirmRequest) => void;
  commit: Commit;
}

function QuestionEditor({
  universe,
  universes,
  question,
  single,
  focusTarget,
  onRequestFocus,
  askConfirm,
  commit,
}: QuestionEditorProps) {
  const at = (...rest: ContentPath): ContentPath => ['questions', { id: question.id }, ...rest];
  const isNew = focusTarget === `question:${question.id}`;
  const [initiallyOpen] = useState(isNew || single);
  const toggleRevealed = (field: RevealField, nodeId: string, checked: boolean) => {
    const current = question[field] ?? [];
    const next = checked ? [...current, nodeId] : current.filter((id) => id !== nodeId);
    commit({ op: 'set', path: at(field), value: next });
  };
  const revealChecklist = (field: RevealField) => (
    <div className="setup-checks">
      {universes.map((candidate) => (
        <fieldset key={candidate.id} className="setup-fieldset">
          <legend>{candidate.name}</legend>
          {candidate.nodes.map((node) => (
            <CheckboxField
              key={node.id}
              label={node.title}
              checked={(question[field] ?? []).includes(node.id)}
              onChange={(checked) => toggleRevealed(field, node.id, checked)}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
  const nodeOptions = universe.nodes.map((node) => ({ value: node.id, label: node.title }));

  const deleteQuestion = () => {
    askConfirm({
      title: 'Supprimer la question',
      lines: [`Supprimer la question « ${question.id} » ?`],
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: () => commit({ op: 'delete', path: ['questions', { id: question.id }] }),
    });
  };

  const prompt = question.prompt.trim();
  const title = prompt === '' ? question.id : prompt.length > QUESTION_TITLE_LENGTH ? `${prompt.slice(0, QUESTION_TITLE_LENGTH)}…` : prompt;

  return (
    <article className="setup-question" aria-label={`Question ${question.id}`}>
      <details open={initiallyOpen}>
        <summary>
          <span className="setup-question-title">{title}</span>
          <code>{question.id}</code>
        </summary>
        <div className="setup-subcard">
          <SelectField
            label="Nœud ciblé"
            value={question.targetNodeId}
            options={nodeOptions}
            onChange={(value) => commit({ op: 'set', path: at('targetNodeId'), value })}
          />
          <p className="hint">Changer le nœud ciblé déplace la question hors de ce nœud.</p>
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
            autoFocus={isNew}
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

          <fieldset className="setup-fieldset">
            <legend>Réponses acceptées</legend>
            {question.answers.map((answer, answerIndex) => (
              <div key={answerIndex} className="setup-row">
                <TextField
                  label={`Réponse ${answerIndex + 1}`}
                  value={answer}
                  autoFocus={focusTarget === `answer:${question.id}:${answerIndex}`}
                  onCommit={(value) => {
                    if (value.trim() !== '') commit({ op: 'set', path: at('answers', answerIndex), value });
                  }}
                />
                <button
                  type="button"
                  className="danger icon-button"
                  disabled={question.answers.length <= 1}
                  aria-label={`Supprimer la réponse ${answerIndex + 1}`}
                  onClick={() => commit({ op: 'delete', path: at('answers', answerIndex) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                onRequestFocus(`answer:${question.id}:${question.answers.length}`);
                commit({ op: 'push', path: at('answers'), value: 'Nouvelle réponse' });
              }}
            >
              Ajouter une réponse
            </button>
          </fieldset>

          <TextField
            label="Retour en cas d'erreur"
            multiline
            value={question.wrongFeedback}
            onCommit={(value) => commit({ op: 'set', path: at('wrongFeedback'), value })}
          />

          <button type="button" className="danger" onClick={deleteQuestion}>
            Supprimer la question
          </button>
        </div>
      </details>
    </article>
  );
}

function newQuestionId(universes: Universe[], node: StoryNode): string {
  const taken = new Set(universes.flatMap((candidate) => candidate.questions.map((question) => question.id)));
  return uniqueId(`q-${node.id}`, taken);
}

function newRelationId(universe: Universe, from: string, to: string): string {
  const taken = new Set(universe.relations.map((relation) => relation.id));
  return uniqueId(`link-${from}-${to}`, taken);
}
