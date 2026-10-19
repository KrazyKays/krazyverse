import { describe, expect, it } from 'vitest';
import { isAnswerAccepted, levenshtein, normalizeAnswer } from '../domain/answers';

describe('normalisation des réponses', () => {
  it('ignore la casse, les accents, la ponctuation et les articles', () => {
    expect(normalizeAnswer("  L'Ombre, déjà là ! ")).toBe('ombre deja');
    expect(normalizeAnswer('Un Fil Coupé')).toBe('fil coupe');
    expect(normalizeAnswer("d'un cœur")).toBe('coeur');
  });
});

describe('distance de Levenshtein', () => {
  it('compte les insertions, suppressions et substitutions', () => {
    expect(levenshtein('chat', 'chat')).toBe(0);
    expect(levenshtein('chat', 'chats')).toBe(1);
    expect(levenshtein('chat', 'chien')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('acceptation des réponses', () => {
  const accepted = ['une fiole de sève de fougère', 'sève de fougère'];

  it('accepte une variante exacte ou avec une faute de frappe', () => {
    expect(isAnswerAccepted('Une fiole de sève de fougère', accepted)).toBe(true);
    expect(isAnswerAccepted('sève de fougre', accepted)).toBe(true);
  });

  it('refuse une réponse trop éloignée ou vide', () => {
    expect(isAnswerAccepted("des pièces d'or", accepted)).toBe(false);
    expect(isAnswerAccepted('   ', accepted)).toBe(false);
  });

  it('n\'autorise aucune faute sur un mot très court', () => {
    expect(isAnswerAccepted('ble', ['ble'])).toBe(true);
    expect(isAnswerAccepted('bli', ['ble'])).toBe(false);
  });
});
