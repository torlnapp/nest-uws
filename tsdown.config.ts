import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: './src/index.ts',
  platform: 'node',
  outDir: './dist',
  target: 'es2024',
  dts: true,
  sourcemap: true,
  exports: true,
});
