import { useState } from 'react';
import type { NodeKind, Question, StoryNode, Universe } from '../domain/types';
import type { Commit, CommitBatch, ContentPath } from './api';
import { planNodeDeletion } from './nodeDeletion';
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
  { value: 'enquete', label: 'Enquête centrale' },
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
  const setFlag = (key: 'revealedAtStart' | 'startVisible' | 'finale', checked: boolean) =>
    commit(checked ? { op: 'set', path: at(key), value: true } : { op: 'delete', path: at(key) });
  const questions = universe.questions.filter((question) => question.targetNodeId === node.id);
  const relations = universe.relations.filter((relation) => relation.from === node.id || relation.to === node.id);
  const echoes = universe.echoes.filter((echo) => echo.sourceNodeId === node.id);
  const allNodes = universes.flatMap((candidate) => candidate.nodes);

  const deleteNode = () => {
    const plan = planNodeDeletion(universes, universe.id, node.id);
    const { relations: relationCount, echoes: echoCount, questions: questionCount, requirements } = plan.counts;
    const message = [
      `Supprimer « ${node.title} » ?`,
      `Supprime ${relationCount} lien(s), ${echoCount} écho(s) et ${questionCount} question(s).`,
      requirements > 0 ? `Retire ce nœud des prérequis de ${requirements} question(s).` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (!window.confirm(message)) return;
    commitBatch(plan.edits);
    onDeleted();
  };

  const startState = node.revealedAtStart
    ? 'révélé dès le départ'
    : node.startVisible
      ? 'visible (censuré) dès le départ'
      : 'caché, apparaît quand un voisin est révélé';

  return (
    <section className="setup-card" aria-label={`Nœud ${node.title}`}>
      <p className="kind">
        {KIND_LABELS[node.kind]} · <code>{node.id}</code>
      </p>
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
      <p className="hint">Le contenu est accessible et ses échos se déclenchent dès le début.</p>
      <CheckboxField
        label="Visible au départ"
        checked={node.startVisible === true}
        onChange={(checked) => setFlag('startVisible', checked)}
      />
      <p className="hint">
        Apparaît censuré sur le graphe sans voisin révélé. Sans effet si « Révélé au départ » est coché.
      </p>
      <CheckboxField label="Nœud final" checked={node.finale === true} onChange={(checked) => setFlag('finale', checked)} />
      <p className="hint">Le révéler termine l'enquête. Sans effet sur la fin de partie hors de l'univers central.</p>
      {universe.kind === 'meta' && (
        <>
          <CheckboxField
            label="Requis pour l'enquête centrale"
            checked={node.central?.required === true}
            onChange={(checked) => commit({ op: 'set', path: at('central', 'required'), value: checked })}
          />
          <p className="hint">Compte dans le décompte « nœuds restants » de l'enquête. Ne bloque pas la conclusion.</p>
        </>
      )}

      <h3>Lore</h3>
      {node.sections.map((section) => (
        <div key={section.id} className="setup-subcard">
          <TextField
            label="Titre de la section"
            value={section.title}
            onCommit={(value) => commit({ op: 'set', path: at('sections', { id: section.id }, 'title'), value })}
          />
          <TextField
            label="Texte"
            multiline
            value={section.body}
            onCommit={(value) => commit({ op: 'set', path: at('sections', { id: section.id }, 'body'), value })}
          />
          <SelectField
            label="Débloquée par la question"
            value={section.unlockedByQuestionId ?? ''}
            options={[
              { value: '', label: 'Toujours visible' },
              ...universe.questions.map((question) => ({ value: question.id, label: question.id })),
            ]}
            onChange={(value) =>
              commit(
                value
                  ? { op: 'set', path: at('sections', { id: section.id }, 'unlockedByQuestionId'), value }
                  : { op: 'delete', path: at('sections', { id: section.id }, 'unlockedByQuestionId') },
              )
            }
          />
          <button
            type="button"
            className="danger"
            onClick={() => commit({ op: 'delete', path: at('sections', { id: section.id }) })}
          >
            Supprimer la section
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          commit({
            op: 'push',
            path: at('sections'),
            value: { id: newSectionId(universe, node), title: 'Nouvelle section', body: '' },
          })
        }
      >
        Ajouter une section
      </button>

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

      <h3>Échos</h3>
      {echoes.length === 0 && <p className="hint">Aucun écho.</p>}
      <ul className="setup-list">
        {echoes.map((echo) => {
          const target = allNodes.find((candidate) => candidate.id === echo.targetNodeId);
          return (
            <li key={echo.id} className="hint">
              {target?.title ?? echo.targetNodeId}
            </li>
          );
        })}
      </ul>

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

      <h3>Danger</h3>
      <button type="button" className="danger" onClick={deleteNode}>
        Supprimer le nœud
      </button>
    </section>
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

interface QuestionEditorProps {
  universe: Universe;
  universes: Universe[];
  question: Question;
  commit: Commit;
}

function QuestionEditor({ universe, universes, question, commit }: QuestionEditorProps) {
  const at = (...rest: ContentPath): ContentPath => ['questions', { id: question.id }, ...rest];
  const toggleRevealed = (nodeId: string, checked: boolean) => {
    const next = checked
      ? [...question.requiresRevealed, nodeId]
      : question.requiresRevealed.filter((id) => id !== nodeId);
    commit({ op: 'set', path: at('requiresRevealed'), value: next });
  };
  const nodeOptions = universe.nodes.map((node) => ({ value: node.id, label: node.title }));

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
        <div className="setup-checks">
          {universes.map((candidate) => (
            <div key={candidate.id}>
              <p className="hint">{candidate.name}</p>
              {candidate.nodes.map((node) => (
                <CheckboxField
                  key={node.id}
                  label={node.title}
                  checked={question.requiresRevealed.includes(node.id)}
                  onChange={(checked) => toggleRevealed(node.id, checked)}
                />
              ))}
            </div>
          ))}
        </div>
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
    </article>
  );
}

function newSectionId(universe: Universe, node: StoryNode): string {
  const taken = new Set(universe.nodes.flatMap((candidate) => candidate.sections.map((section) => section.id)));
  let index = node.sections.length + 1;
  while (taken.has(`${node.id}-section-${index}`)) index += 1;
  return `${node.id}-section-${index}`;
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
