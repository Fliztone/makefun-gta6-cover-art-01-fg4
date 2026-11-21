// Vice Cover — gta6-cover-art-01 hand-in program (Node 22, standard library
// only). Copies the static app/ and the maker's screenshots/ into the output
// directory ($MAKEFUN_OUTPUT_DIR outside the grader, /output inside it) and
// writes dossier.json with the kit's buildDossier. No clock, no randomness,
// no network: two runs produce byte-identical output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored here so a broken tree fails loudly at hand-in
// time instead of silently at the gate.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
    else throw new Error(`app/ must hold plain files and directories: ${full}`);
  }
  return found;
}

function preflightApp(appDir: string): void {
  const files = walk(appDir);
  let totalBytes = 0;
  for (const file of files) {
    const rel = relative(appDir, file);
    if (Buffer.byteLength(rel, 'utf8') > CAPS.app_path_max_bytes) {
      throw new Error(`app path too long: ${rel}`);
    }
    totalBytes += statSync(file).size;
  }
  // Count directories too: the cap covers files and directories together.
  const dirs = new Set(files.map((f) => relative(appDir, f).split(/[\\/]/).slice(0, -1).join('/')));
  dirs.delete('');
  if (files.length + dirs.size + 1 > CAPS.app_max_files) throw new Error('app/ holds too many entries');
  if (totalBytes > CAPS.app_max_bytes) throw new Error('app/ is too large');
  const index = join(appDir, 'index.html');
  if (!existsSync(index) || statSync(index).size > 1048576) throw new Error('app/index.html missing or over 1 MiB');
}

mkdirSync(outputDir, { recursive: true });

const appSource = join(repoRoot, 'app');
preflightApp(appSource);
cpSync(appSource, join(outputDir, 'app'), { recursive: true });

const shotsSource = join(repoRoot, 'screenshots');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsSource)) {
  const shots = readdirSync(shotsSource).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/ must hold 3..4 images, found ${shots.length}`);
  }
  for (const name of shots) {
    if (statSync(join(shotsSource, name)).size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshot over 256 KiB: ${name}`);
    }
  }
  cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, CAPS));
console.log(`Vice Cover handed in: app/ + screenshots/ + dossier.json -> ${outputDir}`);
// build marker