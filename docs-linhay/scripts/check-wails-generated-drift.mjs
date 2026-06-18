#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runBindingSurfaceCheck } from './check-wails-binding-surface.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');

export const GENERATED_BINDING_ROOT = 'frontend/wailsjs';
export const WAILS_STANDALONE_GENERATE_COMMAND = ['bash', 'scripts/wails-cli.sh', 'generate', 'bindings'];
export const WAILS_GENERATE_COMMAND = WAILS_STANDALONE_GENERATE_COMMAND;
export const WAILS_BUILD_READINESS_COMMAND = ['bash', 'scripts/wails-cli.sh', 'build'];
export const DEFAULT_WAILS_GENERATED_DRIFT_REPORT_PATH = '/private/tmp/gettokens-wails-generated-drift-report.json';

function toRepoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function readFileIfPresent(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath);
}

function listFilesRecursive(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function isWithinPath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeReportPath(reportPath) {
  const absoluteReportPath = path.resolve(reportPath);
  const docsRoot = path.join(repoRoot, 'docs-linhay');
  const generatedRoot = path.join(repoRoot, GENERATED_BINDING_ROOT);
  const allowedRoots = [docsRoot, '/private/tmp'];

  assert.ok(
    allowedRoots.some((rootPath) => isWithinPath(rootPath, absoluteReportPath)),
    `report path must stay under docs-linhay or /private/tmp: ${absoluteReportPath}`,
  );
  assert.ok(
    !isWithinPath(generatedRoot, absoluteReportPath),
    `report path must not live under generated bindings root: ${absoluteReportPath}`,
  );
  return absoluteReportPath;
}

export function parseGeneratedBindingDriftArgs(argv) {
  let reportPath = DEFAULT_WAILS_GENERATED_DRIFT_REPORT_PATH;
  let buildReadiness = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--report') {
      const nextValue = argv[index + 1];
      assert.ok(nextValue, '--report requires a path');
      reportPath = nextValue;
      index += 1;
      continue;
    }
    if (value.startsWith('--report=')) {
      reportPath = value.slice('--report='.length);
      continue;
    }
    if (value === '--build-readiness') {
      buildReadiness = true;
      continue;
    }
    assert.fail(`unknown argument: ${value}`);
  }
  return {
    reportPath: assertSafeReportPath(reportPath),
    buildReadiness,
  };
}

export function getGeneratedBindingTargets() {
  const rootPath = path.join(repoRoot, GENERATED_BINDING_ROOT);
  return listFilesRecursive(rootPath)
    .map(toRepoPath)
    .filter((relativePath) => !relativePath.endsWith('.test.mjs'))
    .sort();
}

function takeSnapshot(targets) {
  const snapshot = new Map();
  for (const target of targets) {
    snapshot.set(target, readFileIfPresent(target));
  }
  return snapshot;
}

function restoreSnapshot(snapshot, afterTargets) {
  const beforeTargets = new Set(snapshot.keys());
  for (const target of afterTargets) {
    if (!beforeTargets.has(target)) {
      const absolutePath = path.join(repoRoot, target);
      if (fs.existsSync(absolutePath)) {
        fs.rmSync(absolutePath, { force: true });
      }
    }
  }
  for (const [target, content] of snapshot) {
    const absolutePath = path.join(repoRoot, target);
    if (content === null) {
      if (fs.existsSync(absolutePath)) {
        fs.rmSync(absolutePath, { force: true });
      }
      continue;
    }
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
}

function classifyChangedFile(beforeContent, afterContent) {
  if (beforeContent === null && afterContent !== null) {
    return 'added';
  }
  if (beforeContent !== null && afterContent === null) {
    return 'deleted';
  }
  return 'modified';
}

function collectChangedFiles(snapshot, afterTargets) {
  const targets = [...new Set([...snapshot.keys(), ...afterTargets])].sort();
  const changedFiles = [];
  for (const target of targets) {
    const beforeContent = snapshot.has(target) ? snapshot.get(target) : null;
    const afterContent = readFileIfPresent(target);
    const same =
      beforeContent === null && afterContent === null
        ? true
        : beforeContent !== null && afterContent !== null && Buffer.compare(beforeContent, afterContent) === 0;
    if (same) {
      continue;
    }
    changedFiles.push({
      path: target,
      status: classifyChangedFile(beforeContent, afterContent),
    });
  }
  return changedFiles;
}

function runCommand(commandParts) {
  const [command, ...args] = commandParts;
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GETTOKENS_APP_PROFILE: process.env.GETTOKENS_APP_PROFILE || 'dev',
    },
    maxBuffer: 20 * 1024 * 1024,
  });
}

function parseAvailableGenerateCommands(output) {
  const commands = [];
  for (const line of output.split('\n')) {
    const match = /^\s{3}([a-z][a-z0-9-]*)\s{2,}/.exec(line);
    if (match) {
      commands.push(match[1]);
    }
  }
  return [...new Set(commands)].sort();
}

function detectBindingGenerationSupport(generatorResult) {
  const output = `${generatorResult.stdout || ''}\n${generatorResult.stderr || ''}`;
  const availableGenerateCommands = parseAvailableGenerateCommands(output);
  if (/Wails generate - Code Generation Tools/.test(output) && !/\bbindings\b/.test(output)) {
    return {
      available: false,
      reason: 'wails generate bindings is not supported by the current project wrapper / Wails CLI output.',
      terminalBoundary: true,
      availableGenerateCommands,
    };
  }
  if (generatorResult.status !== 0) {
    return {
      available: false,
      reason: 'project wrapper returned a non-zero status while attempting Wails binding generation.',
      terminalBoundary: false,
      availableGenerateCommands,
    };
  }
  return {
    available: true,
    reason: '',
    terminalBoundary: false,
    availableGenerateCommands,
  };
}

function summarizeOutput(value) {
  return value.trim().split('\n').slice(-40).join('\n');
}

function classifyDriftKind(bindingGenerationAvailable, changedFiles) {
  if (changedFiles.length === 0) {
    return 'none';
  }
  return bindingGenerationAvailable ? 'generated-drift' : 'wrapper-side-effect';
}

function runSurfaceCheck() {
  try {
    runBindingSurfaceCheck();
    return {
      status: 'pass',
      reason: '',
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function runBuildReadinessCheck() {
  const beforeTargets = getGeneratedBindingTargets();
  const snapshot = takeSnapshot(beforeTargets);
  let restored = false;
  let result;
  let afterTargets = beforeTargets;
  let changedGeneratedFiles = [];

  try {
    result = runCommand(WAILS_BUILD_READINESS_COMMAND);
    afterTargets = getGeneratedBindingTargets();
    changedGeneratedFiles = collectChangedFiles(snapshot, afterTargets);
  } finally {
    restoreSnapshot(snapshot, afterTargets);
    restored = true;
  }

  const artifactPath = 'build/bin/GetTokens.app';
  const artifactAbsolutePath = path.join(repoRoot, artifactPath);
  let status = 'pass';
  let reason = '';
  if (result.status !== 0) {
    status = 'failed';
    reason = 'project Wails build command returned a non-zero status.';
  } else if (changedGeneratedFiles.length > 0) {
    status = 'generated-drift-detected';
    reason = 'project Wails build changed generated bindings; files were restored from the pre-build snapshot.';
  } else if (!fs.existsSync(artifactAbsolutePath)) {
    status = 'artifact-missing';
    reason = 'project Wails build exited successfully but build/bin/GetTokens.app is missing.';
  }

  return {
    requested: true,
    command: [...WAILS_BUILD_READINESS_COMMAND],
    commandString: WAILS_BUILD_READINESS_COMMAND.join(' '),
    trigger: 'wails-build-or-dev',
    artifactPath,
    artifactExists: fs.existsSync(artifactAbsolutePath),
    buildBundleSidecarPath: 'build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api',
    buildBundleSidecarManagedByWrapper: true,
    formalApplicationsPathTouched: false,
    formalBundleSidecarTouched: false,
    generatedSnapshotRestored: restored,
    changedGeneratedFiles,
    status,
    reason,
    exitStatus: result.status,
    signal: result.signal,
    stdoutTail: summarizeOutput(result.stdout || ''),
    stderrTail: summarizeOutput(result.stderr || ''),
  };
}

function classifyExit(bindingGenerationAvailable, changedFiles, surfaceCheck, buildReadiness) {
  if (surfaceCheck.status !== 'pass') {
    return 'surface-check-failed';
  }
  if (buildReadiness.requested) {
    if (buildReadiness.status === 'pass') {
      return changedFiles.length > 0 ? 'generated-binding-drift-detected' : 'build-readiness-pass';
    }
    if (buildReadiness.status === 'generated-drift-detected') {
      return 'build-generated-drift-detected';
    }
    return 'build-readiness-failed';
  }
  if (!bindingGenerationAvailable) {
    return changedFiles.length > 0
      ? 'generator-unavailable-with-side-effects'
      : 'standalone-generator-unavailable-surface-pass';
  }
  return changedFiles.length > 0 ? 'generated-binding-drift-detected' : 'pass';
}

function writeReportArtifact(report, reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

export function runGeneratedBindingDriftCheck(options = {}) {
  const reportArtifactPath = assertSafeReportPath(
    options.reportPath || DEFAULT_WAILS_GENERATED_DRIFT_REPORT_PATH,
  );
  const beforeTargets = getGeneratedBindingTargets();
  assert.ok(beforeTargets.length > 0, `missing generated binding targets under ${GENERATED_BINDING_ROOT}`);
  const snapshot = takeSnapshot(beforeTargets);
  let restored = false;
  let generator;
  let afterTargets = beforeTargets;
  let changedFiles = [];

  try {
    generator = runCommand(WAILS_STANDALONE_GENERATE_COMMAND);
    afterTargets = getGeneratedBindingTargets();
    changedFiles = collectChangedFiles(snapshot, afterTargets);
  } finally {
    restoreSnapshot(snapshot, afterTargets);
    restored = true;
  }

  const support = detectBindingGenerationSupport(generator);
  const surfaceCheck = runSurfaceCheck();
  const buildReadiness = options.buildReadiness
    ? runBuildReadinessCheck()
    : {
        requested: false,
        command: [...WAILS_BUILD_READINESS_COMMAND],
        commandString: WAILS_BUILD_READINESS_COMMAND.join(' '),
        trigger: 'wails-build-or-dev',
        artifactPath: 'build/bin/GetTokens.app',
        buildBundleSidecarPath: 'build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api',
        buildBundleSidecarManagedByWrapper: true,
        formalApplicationsPathTouched: false,
        formalBundleSidecarTouched: false,
        status: 'not-run',
        reason: 'pass --build-readiness to run the project Wails build smoke.',
      };
  const driftKind = classifyDriftKind(support.available, changedFiles);
  const sideEffectFiles = support.available ? [] : changedFiles;
  const exitClassification = classifyExit(support.available, changedFiles, surfaceCheck, buildReadiness);

  const report = {
    schemaVersion: 3,
    generatedRoot: GENERATED_BINDING_ROOT,
    wrapperCommand: [...WAILS_STANDALONE_GENERATE_COMMAND],
    wrapperCommandString: WAILS_STANDALONE_GENERATE_COMMAND.join(' '),
    standaloneGenerator: {
      command: [...WAILS_STANDALONE_GENERATE_COMMAND],
      commandString: WAILS_STANDALONE_GENERATE_COMMAND.join(' '),
      available: support.available,
      terminalBoundary: support.terminalBoundary,
      unavailableReason: support.reason,
      availableGenerateCommands: support.availableGenerateCommands,
    },
    readinessAlternative: {
      command: [...WAILS_BUILD_READINESS_COMMAND],
      commandString: WAILS_BUILD_READINESS_COMMAND.join(' '),
      trigger: 'wails-build-or-dev',
      artifactPath: 'build/bin/GetTokens.app',
      reason:
        'Wails v2.12.0 does not expose a standalone generate bindings subcommand; project build/dev commands remain the readiness path that runs Wails binding generation as part of the lifecycle.',
    },
    surfaceCheck,
    buildReadiness,
    formalApplicationsPathTouched: false,
    formalBundleSidecarTouched: false,
    reportArtifactPath,
    targetCount: beforeTargets.length,
    bindingGenerationAvailable: support.available,
    unavailableReason: support.reason,
    restored,
    changedFiles,
    driftKind,
    sideEffectFiles,
    acceptedGeneratedDiff: false,
    exitClassification,
    generatorStatus: generator.status,
    generatorSignal: generator.signal,
    generatorStdoutTail: summarizeOutput(generator.stdout || ''),
    generatorStderrTail: summarizeOutput(generator.stderr || ''),
  };
  writeReportArtifact(report, reportArtifactPath);
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const report = runGeneratedBindingDriftCheck(parseGeneratedBindingDriftArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(
    ['pass', 'standalone-generator-unavailable-surface-pass', 'build-readiness-pass'].includes(
      report.exitClassification,
    )
      ? 0
      : 1,
  );
}
