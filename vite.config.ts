import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { isMap, isSeq, parseDocument, type Document } from 'yaml';

const repoName = process.env.VITE_REPO_NAME ?? 'krazyverse';

type PathSegment = string | number | { id: string };

interface ContentEdit {
  universeId: string;
  op: 'set' | 'push' | 'delete';
  path: PathSegment[];
  value?: unknown;
}

function contentEditor(): Plugin {
  return {
    name: 'krazyverse-content-editor',
    apply: 'serve',
    configureServer(server) {
      const contentDir = path.resolve(server.config.root, 'content');
      server.middlewares.use('/__setup/edit', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
        });
        req.on('end', () => {
          try {
            applyContentEdits(contentDir, (JSON.parse(body) as { edits: ContentEdit[] }).edits);
            res.setHeader('Content-Type', 'application/json');
            res.end('{"ok":true}');
          } catch (error) {
            res.statusCode = 400;
            res.end(error instanceof Error ? error.message : String(error));
          }
        });
      });
    },
  };
}

function applyContentEdits(contentDir: string, edits: ContentEdit[]): void {
  const documents = new Map<string, { file: string; doc: Document }>();

  for (const edit of edits) {
    if (edit.path.length === 0) throw new Error('Chemin vide');
    let loaded = documents.get(edit.universeId);
    if (!loaded) {
      loaded = loadUniverseDocument(contentDir, edit.universeId);
      documents.set(edit.universeId, loaded);
    }
    const path = resolvePath(loaded.doc, edit.path);

    if (edit.op === 'set') loaded.doc.setIn(path, edit.value);
    else if (edit.op === 'push') loaded.doc.addIn(path, edit.value);
    else loaded.doc.deleteIn(path);
  }

  for (const { file, doc } of documents.values()) {
    writeFileSync(file, doc.toString({ lineWidth: 0 }));
  }
}

function resolvePath(doc: Document, segments: PathSegment[]): (string | number)[] {
  const resolved: (string | number)[] = [];
  for (const segment of segments) {
    if (typeof segment !== 'object') {
      resolved.push(segment);
      continue;
    }
    const items = doc.getIn(resolved, true);
    if (!isSeq(items)) throw new Error(`Liste introuvable pour ${segment.id}`);
    const index = items.items.findIndex((item) => isMap(item) && item.get('id') === segment.id);
    if (index < 0) throw new Error(`Élément introuvable : ${segment.id}`);
    resolved.push(index);
  }
  return resolved;
}

function loadUniverseDocument(contentDir: string, universeId: string): { file: string; doc: Document } {
  for (const name of readdirSync(contentDir)) {
    if (!name.endsWith('.yaml')) continue;
    const file = path.join(contentDir, name);
    const doc = parseDocument(readFileSync(file, 'utf8'));
    if (doc.get('id') !== universeId) continue;
    if (doc.errors.length > 0) throw doc.errors[0];
    return { file, doc };
  }
  throw new Error(`Univers introuvable : ${universeId}`);
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/',
  plugins: [react(), contentEditor()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
