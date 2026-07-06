import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractClass(source, className) {
  const start = source.indexOf(`export class ${className}`);
  assert.notEqual(start, -1, `missing generated class ${className}`);
  const nextClass = source.indexOf('\nexport class ', start + 1);
  return source.slice(start, nextClass === -1 ? source.length : nextClass);
}

test('doctor typed evidence binding keeps droppedReason across Wails root and generated models', () => {
  const internalTypes = read('internal/wailsapp/types.go');
  const rootTypes = read('cmd/gettokens/app_types.go');
  const rootMappers = read('cmd/gettokens/app_mappers.go');
  const appJS = read('frontend/wailsjs/go/main/App.js');
  const appTypes = read('frontend/wailsjs/go/main/App.d.ts');
  const models = read('frontend/wailsjs/go/models.ts');
  const doctorModel = read('frontend/src/features/doctor-workbench/model/doctorWorkbench.ts');

  assert.match(
    internalTypes,
    /DroppedReason\s+\*DoctorRouteEvidencePayload\s+`json:"droppedReason,omitempty"`/,
  );
  assert.match(
    rootTypes,
    /DroppedReason\s+\*DoctorRouteEvidencePayload\s+`json:"droppedReason,omitempty"`/,
  );
  assert.match(rootMappers, /DroppedReason:\s+mapDoctorRouteEvidencePayload\(item\.DroppedReason\)/);

  assert.match(appJS, /export function GetDoctorSnapshot\(arg1\)/);
  assert.match(appTypes, /GetDoctorSnapshot\(arg1:main\.DoctorSnapshotInput\):Promise<main\.DoctorSnapshot>/);

  const evidenceClass = extractClass(models, 'DoctorEvidenceRef');
  assert.match(evidenceClass, /droppedReason\?:\s+DoctorRouteEvidencePayload;/);
  assert.match(
    evidenceClass,
    /this\.droppedReason\s*=\s*this\.convertValues\(source\["droppedReason"\],\s*DoctorRouteEvidencePayload\)/,
  );
  assert.match(evidenceClass, /routeEvidence\?:\s+DoctorRouteEvidencePayload;/);
  assert.match(evidenceClass, /quotaFact\?:\s+CodexQuotaFact;/);

  const routePayloadClass = extractClass(models, 'DoctorRouteEvidencePayload');
  for (const field of ['accountKey', 'accountID', 'authId', 'model', 'source', 'scope', 'reason']) {
    assert.match(routePayloadClass, new RegExp(`${field}\\?:\\s+string;`));
    assert.match(routePayloadClass, new RegExp(`this\\.${field}\\s*=\\s*source\\["${field}"\\]`));
  }
  assert.match(routePayloadClass, /routeBlocking\?:\s+boolean;/);
  assert.match(routePayloadClass, /this\.routeBlocking\s*=\s*source\["routeBlocking"\]/);

  assert.match(doctorModel, /droppedReason\?:\s+Readonly<DoctorRouteEvidencePayload>/);
  assert.match(doctorModel, /const droppedReason = evidence\.droppedReason/);
  assert.match(doctorModel, /droppedReason\?\.routeBlocking/);
});
