export type ContentPath = (string | number | { id: string })[];

export type ContentEdit =
  | { op: 'set'; path: ContentPath; value: unknown }
  | { op: 'push'; path: ContentPath; value: unknown }
  | { op: 'delete'; path: ContentPath };

export type Commit = (edit: ContentEdit) => void;

export async function sendContentEdit(universeId: string, edit: ContentEdit): Promise<void> {
  const response = await fetch('/__setup/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ universeId, ...edit }),
  });
  if (!response.ok) throw new Error(await response.text());
}
