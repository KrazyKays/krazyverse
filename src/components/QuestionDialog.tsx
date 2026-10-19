import { useState, type FormEvent } from 'react';
import type { Question, Universe } from '../domain/types';
import { Dialog } from './Dialog';

interface QuestionDialogProps {
  universe: Universe;
  question: Question;
  onAnswer: (answer: string) => boolean;
  onClose: () => void;
}

export function QuestionDialog({ universe, question, onAnswer, onClose }: QuestionDialogProps) {
  const [text, setText] = useState('');
  const [wrong, setWrong] = useState(false);
  const [solved, setSolved] = useState(false);
  const targetTitle = universe.nodeById.get(question.targetNodeId)?.title ?? '';
  const inputId = `answer-${question.id}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (solved) return;
    if (onAnswer(text)) {
      setWrong(false);
      setSolved(true);
    } else {
      setWrong(true);
    }
  };

  return (
    <Dialog title="Enquête" onClose={onClose}>
      <div className="question">
        <p className="question-context">{question.context}</p>
        <p className="question-prompt">{question.prompt}</p>

        {solved ? (
          <div className="question-success" role="status">
            <p>Bonne réponse. Le nœud « {targetTitle} » est révélé.</p>
            <button type="button" className="primary" onClick={onClose}>
              Continuer
            </button>
          </div>
        ) : (
          <>
            <form className="answer-form" onSubmit={submit}>
              <label htmlFor={inputId}>Ta réponse</label>
              <input
                id={inputId}
                className="answer-input"
                type="text"
                autoComplete="off"
                autoFocus
                value={text}
                aria-invalid={wrong}
                onChange={(event) => setText(event.target.value)}
              />
              <button type="submit" className="primary">
                Valider
              </button>
            </form>
            {wrong && (
              <p className="question-feedback" role="alert">
                {question.wrongFeedback}
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
