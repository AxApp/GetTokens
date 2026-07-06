import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(frontendDir, '..');
const sourceDir = path.join(frontendDir, 'dist');
const targetDir = path.join(repoRoot, 'cmd', 'gettokens', 'frontend', 'dist');

await rm(targetDir, { force: true, recursive: true });
await mkdir(path.dirname(targetDir), { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });
await writeFile(path.join(targetDir, '.gitkeep'), '');
