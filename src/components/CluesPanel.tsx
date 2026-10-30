import type { OpenQuestion } from '../domain/progression';

interface CluesPanelProps {
  clues: OpenQuestion[];
  currentUniverseId: string;
  onOpenQuestion: (universeId: string, questionId: string) => void;
}

export function CluesPanel({ clues, currentUniverseId, onOpenQuestion }: CluesPanelProps) {
  if (clues.length === 0) {
    return (
      <div className="reading">
        <p className="kind">Pistes</p>
        <h2>Aucune piste ouverte</h2>
        <p className="hint">
          Relisez les récits déjà révélés et visitez les autres univers : une découverte faite ailleurs ouvre souvent de
          nouvelles questions.
        </p>
      </div>
    );
  }

  // Les pistes de l'univers affiché d'abord, puis les autres dans l'ordre de navigation.
  const sorted = [...clues].sort(
    (a, b) => Number(b.universe.id === currentUniverseId) - Number(a.universe.id === currentUniverseId),
  );

  return (
    <div className="clues">
      <p className="kind">
        {clues.length} piste{clues.length > 1 ? 's' : ''} ouverte{clues.length > 1 ? 's' : ''}
      </p>
      <ul className="clue-list">
        {sorted.map(({ universe, question }) => (
          <li key={question.id}>
            <button type="button" className="clue" onClick={() => onOpenQuestion(universe.id, question.id)}>
              <span className="clue-universe">
                {universe.name}
                {universe.id === currentUniverseId && <span className="here"> · ici</span>}
              </span>
              <span className="clue-prompt">{question.prompt}</span>
              {question.context && <span className="clue-context">{question.context}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
