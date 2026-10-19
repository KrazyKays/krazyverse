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
  const given = normalizeAnswer(input);
  if (given === '') return false;
  return acceptedAnswers.some((accepted) => {
    const reference = normalizeAnswer(accepted);
    return levenshtein(given, reference) <= allowedTypos(reference);
  });
}
