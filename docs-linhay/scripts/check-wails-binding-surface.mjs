#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractGoStruct(source, structName) {
  const match = new RegExp(`type\\s+${escapeRegExp(structName)}\\s+struct\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  assert.ok(match, `missing Go struct ${structName}`);
  return match[1];
}

function assertGoField(source, structName, fieldName, typePattern, jsonName) {
  const body = extractGoStruct(source, structName);
  const pattern = new RegExp(
    `${escapeRegExp(fieldName)}\\s+${typePattern}\\s+\`json:"${escapeRegExp(jsonName)}(?:,omitempty)?"\``,
  );
  assert.match(body, pattern, `${structName}.${fieldName} must expose json ${jsonName}`);
}

function extractModelClass(source, className) {
  const start = source.indexOf(`export class ${className}`);
  assert.notEqual(start, -1, `missing generated class ${className}`);
  const nextClassWithTab = source.indexOf('\n\texport class ', start + 1);
  const nextClassPlain = source.indexOf('\nexport class ', start + 1);
  const candidates = [nextClassWithTab, nextClassPlain].filter((value) => value !== -1);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

function assertModelField(classSource, fieldName, tsPattern) {
  assert.match(classSource, new RegExp(`${escapeRegExp(fieldName)}\\??:\\s*${tsPattern};`));
  assert.match(classSource, new RegExp(`this\\.${escapeRegExp(fieldName)}\\s*=\\s*source\\["${escapeRegExp(fieldName)}"\\]`));
}

function assertModelConvertedField(classSource, fieldName, tsPattern, targetClass) {
  assert.match(classSource, new RegExp(`${escapeRegExp(fieldName)}\\??:\\s*${tsPattern};`));
  assert.match(
    classSource,
    new RegExp(
      `this\\.${escapeRegExp(fieldName)}\\s*=\\s*this\\.convertValues\\(source\\["${escapeRegExp(fieldName)}"\\],\\s*${escapeRegExp(targetClass)}\\)`,
    ),
  );
}

function assertAppBinding(appJS, appTypes, methodName, inputType, outputType) {
  assert.match(appJS, new RegExp(`export function ${escapeRegExp(methodName)}\\(arg1\\)`));
  assert.match(
    appJS,
    new RegExp(`window\\['go'\\]\\['main'\\]\\['App'\\]\\['${escapeRegExp(methodName)}'\\]\\(arg1\\)`),
  );
  assert.match(
    appTypes,
    new RegExp(`${escapeRegExp(methodName)}\\(arg1:main\\.${escapeRegExp(inputType)}\\):Promise<main\\.${escapeRegExp(outputType)}>`),
  );
}

export function runBindingSurfaceCheck() {
  const rootTypes = read('cmd/gettokens/app_types.go');
  const internalTypes = read('internal/wailsapp/types.go');
  const internalDoctor = read('internal/wailsapp/doctor.go');
  const internalExtensions = read('internal/wailsapp/gettokens_extensions.go');
  const internalRouting = read('internal/wailsapp/channel_routing.go');
  const extensionPlanner = read('internal/gettokensextensions/config_preview.go');
  const rootApp = read('cmd/gettokens/app.go');
  const rootMappers = read('cmd/gettokens/app_mappers.go');
  const appJS = read('frontend/wailsjs/go/main/App.js');
  const appTypes = read('frontend/wailsjs/go/main/App.d.ts');
  const models = read('frontend/wailsjs/go/models.ts');
  const doctorModel = read('frontend/src/features/doctor-workbench/model/doctorWorkbench.ts');

  assertAppBinding(appJS, appTypes, 'GetDoctorSnapshot', 'DoctorSnapshotInput', 'DoctorSnapshot');
  for (const source of [internalTypes, rootTypes]) {
    assertGoField(source, 'DoctorEvidenceRef', 'DroppedReason', '\\*DoctorRouteEvidencePayload', 'droppedReason');
  }
  assert.match(internalDoctor, /droppedReason := doctorRouteEvidencePayloadFromDiagnosticDroppedReason\(item\.DroppedReason\)/);
  assert.match(internalDoctor, /next\.DroppedReason = droppedReason/);
  assert.match(rootMappers, /DroppedReason:\s+mapDoctorRouteEvidencePayload\(item\.DroppedReason\)/);
  const doctorEvidenceClass = extractModelClass(models, 'DoctorEvidenceRef');
  assertModelConvertedField(doctorEvidenceClass, 'droppedReason', 'DoctorRouteEvidencePayload', 'DoctorRouteEvidencePayload');
  assertModelConvertedField(doctorEvidenceClass, 'routeEvidence', 'DoctorRouteEvidencePayload', 'DoctorRouteEvidencePayload');
  assertModelConvertedField(doctorEvidenceClass, 'quotaFact', 'CodexQuotaFact', 'CodexQuotaFact');
  assert.match(doctorModel, /droppedReason\?:\s+Readonly<DoctorRouteEvidencePayload>/);
  assert.match(doctorModel, /const droppedReason = evidence\.droppedReason/);

  assertAppBinding(
    appJS,
    appTypes,
    'PreviewGetTokensExtensionCodexConfigDryRun',
    'PreviewGetTokensExtensionCodexConfigDryRunInput',
    'GetTokensExtensionCodexConfigDryRunPreview',
  );
  for (const source of [internalExtensions, rootTypes]) {
    assertGoField(source, 'PreviewGetTokensExtensionCodexConfigDryRunInput', 'ConfigText', 'string', 'configText');
  }
  assert.match(rootMappers, /ConfigText:\s+input\.ConfigText/);
  assert.match(internalExtensions, /ConfigText:\s+input\.ConfigText/);
  assert.match(extensionPlanner, /ConfigText\s+string/);
  assert.match(extensionPlanner, /PatchPlan\s+CodexConfigTomlPatchPlan\s+`json:"patchPlan"`/);
  assertGoField(rootTypes, 'GetTokensExtensionCodexConfigDryRunOperation', 'PatchPlan', 'GetTokensExtensionCodexConfigTomlPatchPlan', 'patchPlan');
  assertGoField(rootTypes, 'GetTokensExtensionCodexConfigTomlPatchPlan', 'TargetSection', 'string', 'targetSection');
  assertGoField(rootTypes, 'GetTokensExtensionCodexConfigTomlPatchPlan', 'Operation', 'string', 'operation');
  assertGoField(rootTypes, 'GetTokensExtensionCodexConfigTomlPatchPlan', 'BeforeSnippet', 'string', 'beforeSnippet');
  assertGoField(rootTypes, 'GetTokensExtensionCodexConfigTomlPatchPlan', 'AfterSnippet', 'string', 'afterSnippet');
  assertGoField(rootTypes, 'GetTokensExtensionCodexConfigTomlPatchPlan', 'Validation', '\\[\\]string', 'validation');
  assert.match(rootMappers, /PatchPlan:\s+mapGetTokensExtensionCodexConfigTomlPatchPlan\(item\.PatchPlan\)/);
  const dryRunInputClass = extractModelClass(models, 'PreviewGetTokensExtensionCodexConfigDryRunInput');
  assertModelField(dryRunInputClass, 'configText', 'string');
  assertModelConvertedField(dryRunInputClass, 'roots', 'GetTokensExtensionRoot\\[\\]', 'GetTokensExtensionRoot');
  const patchPlanClass = extractModelClass(models, 'GetTokensExtensionCodexConfigTomlPatchPlan');
  for (const field of ['targetSection', 'operation', 'beforeSnippet', 'afterSnippet']) {
    assertModelField(patchPlanClass, field, 'string');
  }
  assertModelField(patchPlanClass, 'validation', 'string\\[\\]');
  const operationClass = extractModelClass(models, 'GetTokensExtensionCodexConfigDryRunOperation');
  assertModelConvertedField(
    operationClass,
    'patchPlan',
    'GetTokensExtensionCodexConfigTomlPatchPlan',
    'GetTokensExtensionCodexConfigTomlPatchPlan',
  );

  assertAppBinding(appJS, appTypes, 'RunRouteResilienceAction', 'RouteResilienceActionInput', 'RouteResilienceActionResult');
  assert.match(rootApp, /func \(a \*App\) RunRouteResilienceAction\(input RouteResilienceActionInput\)/);
  for (const source of [internalRouting, rootTypes]) {
    assertGoField(source, 'RouteResilienceActionResult', 'Before', 'map\\[string\\]any', 'before');
    assertGoField(source, 'RouteResilienceActionResult', 'After', 'map\\[string\\]any', 'after');
    assertGoField(source, 'RouteResilienceActionResult', 'AuditID', 'string', 'auditId');
    assertGoField(source, 'RouteResilienceActionResult', 'DroppedSources', '\\[\\]string', 'droppedSources');
    assertGoField(source, 'RouteResilienceActionResult', 'DroppedReasons', '\\[\\]ChannelRouteDroppedReason', 'droppedReasons');
    assertGoField(source, 'RouteResilienceActionResult', 'Error', 'string', 'error');
    assertGoField(source, 'RouteResilienceActionResult', 'NotImplementedReason', 'string', 'notImplementedReason');
    assertGoField(source, 'RouteResilienceActionResult', 'HTTPStatus', 'int', 'httpStatus');
  }
  assert.match(rootMappers, /Before:\s+cloneRouteResilienceActionMap\(result\.Before\)/);
  assert.match(rootMappers, /After:\s+cloneRouteResilienceActionMap\(result\.After\)/);
  assert.match(rootMappers, /DroppedReasons:\s+mapRouteResilienceDroppedReasons\(result\.DroppedReasons\)/);
  const actionResultClass = extractModelClass(models, 'RouteResilienceActionResult');
  for (const field of ['before', 'after']) {
    assertModelField(actionResultClass, field, 'Record<string, any>');
  }
  for (const field of ['auditId', 'error', 'notImplementedReason']) {
    assertModelField(actionResultClass, field, 'string');
  }
  assertModelField(actionResultClass, 'httpStatus', 'number');
  assertModelField(actionResultClass, 'droppedSources', 'string\\[\\]');
  assertModelConvertedField(actionResultClass, 'droppedReasons', 'ChannelRouteDroppedReason\\[\\]', 'ChannelRouteDroppedReason');
  const droppedReasonClass = extractModelClass(models, 'ChannelRouteDroppedReason');
  for (const [field, tsType] of [
    ['accountID', 'string'],
    ['authID', 'string'],
    ['source', 'string'],
    ['scope', 'string'],
    ['reason', 'string'],
    ['model', 'string'],
    ['expiresAt', 'string'],
    ['updatedAt', 'string'],
    ['routeBlocking', 'boolean'],
  ]) {
    assertModelField(droppedReasonClass, field, tsType);
  }

  assertGoField(rootTypes, 'ChannelRouteDecisionsInput', 'Limit', 'int', 'limit');
  const routeDecisionInputClass = extractModelClass(models, 'ChannelRouteDecisionsInput');
  assertModelField(routeDecisionInputClass, 'limit', 'number');

  assertGoField(rootTypes, 'SessionManagementMessageRecord', 'Truncated', 'bool', 'truncated');
  assertGoField(rootTypes, 'SessionManagementMessagePageInput', 'Limit', 'int', 'limit');
  assertGoField(rootTypes, 'SessionManagementMessagePage', 'Limit', 'int', 'limit');
  const sessionRecordClass = extractModelClass(models, 'SessionManagementMessageRecord');
  const sessionPageInputClass = extractModelClass(models, 'SessionManagementMessagePageInput');
  const sessionPageClass = extractModelClass(models, 'SessionManagementMessagePage');
  assertModelField(sessionRecordClass, 'truncated', 'boolean');
  assertModelField(sessionPageInputClass, 'limit', 'number');
  assertModelField(sessionPageClass, 'limit', 'number');

  const rootRouteActionStruct = extractGoStruct(rootTypes, 'RouteResilienceActionResult');
  if (/LedgerError\s+/.test(rootRouteActionStruct)) {
    assertGoField(internalRouting, 'RouteResilienceActionResult', 'LedgerError', 'string', 'ledgerError');
    assertModelField(actionResultClass, 'ledgerError', 'string');
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runBindingSurfaceCheck();
  console.log('Wails binding surface drift gate passed.');
}
