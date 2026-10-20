const STOP_WORDS = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd']);

export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '' && !STOP_WORDS.has(word))
    .join(' ');
}

export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      current.push(
        Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function allowedTypos(reference: string): number {
  if (reference.length < 5) return 0;
  if (reference.length < 10) return 1;
  return 2;
}

export function isAnswerAccepted(input: string, acceptedAnswers: string[]): boolean {
  const words = normalizeAnswer(input).split(' ').filter((word) => word !== '');
  if (words.length === 0) return false;
  return acceptedAnswers.some((accepted) => {
    const reference = normalizeAnswer(accepted);
    const tolerance = allowedTypos(reference);
    return containsMatchingSpan(words, reference, tolerance);
  });
}

function containsMatchingSpan(words: string[], reference: string, tolerance: number): boolean {
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      if (levenshtein(words.slice(start, end).join(' '), reference) <= tolerance) return true;
    }
  }
  return false;
}
