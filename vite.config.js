import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: works on GitHub Pages for any repo name, and when
  // opening dist/index.html directly.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
