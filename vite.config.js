import { defineConfig } from 'vite';

export default defineConfig({
  // index.html loyiha ildizida (standart Vite konvensiya)
  // root: './' (default)

  // Statik fayllar — public/ papkasidan
  publicDir: 'public',

  server: {
    port: 5173,
    open: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },

  // GLSL fayllarni statik asset sifatida berish
  // ShaderLoader fetch() orqali yuklaydi
  assetsInclude: ['**/*.glsl', '**/*.vert', '**/*.frag'],
});
