// Bundles src/main.js with esbuild and inlines it into dist/index.html (single file, opens from disk).
// `--serve` additionally serves dist/ on http://localhost:8080 for development.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(path.join(root, 'index.html'), 'utf8').replace(
  '<script src="bundle.js"></script>',
  () => `<script>${js}</script>`
);
writeFileSync(path.join(out, 'index.html'), html);
console.log(`Built dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);

if (process.argv.includes('--serve')) {
  createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(readFileSync(path.join(out, 'index.html')));
  }).listen(8080, () => console.log('Open http://localhost:8080'));
}
