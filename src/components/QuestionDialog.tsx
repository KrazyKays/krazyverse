import { useState, type FormEvent } from 'react';
import type { AnswerResult, UniverseMap } from '../domain/progression';
import type { NodeRef, Question, Universe } from '../domain/types';
import { Dialog } from './Dialog';

interface QuestionDialogProps {
  universe: Universe;
  universes: UniverseMap;
  question: Question;
  onAnswer: (answer: string) => AnswerResult;
  onRead: (target: NodeRef) => void;
  onClose: () => void;
}

export function QuestionDialog({ universe, universes, question, onAnswer, onRead, onClose }: QuestionDialogProps) {
  const [text, setText] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [discoveries, setDiscoveries] = useState<NodeRef[] | null>(null);
  const inputId = `answer-${question.id}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (discoveries || text.trim() === '') return;
    const result = onAnswer(text);
    if (result.correct) {
      setDiscoveries(result.discoveries);
      setWrong(false);
    } else {
      setAttempts((count) => count + 1);
      setWrong(true);
    }
  };

  if (discoveries) {
    const [target, ...elsewhere] = discoveries;
    const title = (ref: NodeRef) => universes[ref.universeId]?.nodeById.get(ref.nodeId)?.title ?? ref.nodeId;
    return (
      <Dialog title="Bonne réponse !" eyebrow={universe.name} onClose={onClose}>
        <div className="question question--solved" role="status">
          {target && (
            <p className="reveal-main">
              <span className="spark" aria-hidden="true">
                ✦
              </span>{' '}
              « {title(target)} » est révélé.
            </p>
          )}
          {elsewhere.length > 0 && (
            <>
              <p className="hint">Les noms traversent les univers. Également révélé :</p>
              <ul className="ref-list">
                {elsewhere.map((ref) => (
                  <li key={`${ref.universeId}-${ref.nodeId}`}>
                    <span className="ref-universe">{universes[ref.universeId]?.name}</span>
                    <span>{title(ref)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>
              Fermer
            </button>
            {target && (
              <button type="button" className="primary" autoFocus onClick={() => onRead(target)}>
                Lire le récit
              </button>
            )}
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Question" eyebrow={universe.name} onClose={onClose}>
      <div className="question">
        {question.context && <p className="question-context">{question.context}</p>}
        <p className="question-prompt">{question.prompt}</p>

        <form className="answer-form" onSubmit={submit}>
          <label htmlFor={inputId}>Votre réponse</label>
          <input
            id={inputId}
            className={wrong ? 'answer-input answer-input--wrong' : 'answer-input'}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={text}
            aria-invalid={wrong}
            onChange={(event) => {
              setText(event.target.value);
              setWrong(false);
            }}
          />
          <button type="submit" className="primary" disabled={text.trim() === ''}>
            Valider
          </button>
        </form>

        {wrong && (
          <p className="question-feedback" role="alert">
            {question.wrongFeedback || 'Ce n\'est pas la bonne réponse.'}
          </p>
        )}

        <p className="tip">Un mot-clé suffit ; les accents et les petites fautes de frappe sont tolérés.</p>

        {question.hint &&
          (hintShown ? (
            <p className="question-hint">
              <strong>Indice :</strong> {question.hint}
            </p>
          ) : (
            <button type="button" className="link" onClick={() => setHintShown(true)}>
              {attempts > 0 ? 'Besoin d\'un indice ?' : 'Afficher un indice'}
            </button>
          ))}
      </div>
    </Dialog>
  );
}
