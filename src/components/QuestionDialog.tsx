import { useState } from 'react';
import type { Question, Universe } from '../domain/types';
import { Dialog } from './Dialog';

interface QuestionDialogProps {
  universe: Universe;
  question: Question;
  onAnswer: (choiceId: string) => boolean;
  onClose: () => void;
}

export function QuestionDialog({ universe, question, onAnswer, onClose }: QuestionDialogProps) {
  const [wrongChoiceId, setWrongChoiceId] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const targetTitle = universe.nodeById.get(question.targetNodeId)?.title ?? '';

  const choose = (choiceId: string) => {
    if (solved) return;
    if (onAnswer(choiceId)) {
      setWrongChoiceId(null);
      setSolved(true);
    } else {
      setWrongChoiceId(choiceId);
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
            <ul className="choices">
              {question.choices.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    className={`choice${wrongChoiceId === choice.id ? ' choice--wrong' : ''}`}
                    onClick={() => choose(choice.id)}
                  >
                    {choice.label}
                  </button>
                </li>
              ))}
            </ul>
            {wrongChoiceId && (
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
