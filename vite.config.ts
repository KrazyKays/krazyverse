import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const repoName = process.env.VITE_REPO_NAME ?? 'krazyverse';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
