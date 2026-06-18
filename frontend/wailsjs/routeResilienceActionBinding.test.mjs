import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('route resilience action Wails binding is declared as sidecar passthrough', () => {
  const appJS = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appTypes = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');

  assert.match(appJS, /export function RunRouteResilienceAction\(arg1\)/);
  assert.match(appJS, /window\['go'\]\['main'\]\['App'\]\['RunRouteResilienceAction'\]\(arg1\)/);
  assert.match(appTypes, /RunRouteResilienceAction\(arg1:main\.RouteResilienceActionInput\):Promise<main\.RouteResilienceActionResult>/);
  assert.match(models, /export class RouteResilienceActionInput/);
  assert.match(models, /export class RouteResilienceActionResult/);
  assert.match(models, /droppedReasons\?: ChannelRouteDroppedReason\[\]/);
  assert.match(models, /notImplementedReason\?: string/);
  assert.match(models, /httpStatus\?: number/);
});
