export function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let index = 2;
  while (taken.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  taken.add(id);
  return id;
}
