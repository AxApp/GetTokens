#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.env.GETTOKENS_REPO_ROOT
  ? path.resolve(process.env.GETTOKENS_REPO_ROOT)
  : process.cwd();

const pkg = './internal/protocolbridge';
const unrestrictedTag = 'protocolbridge_unrestricted_listener';
const listenerRestrictedTests = [
  'TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface',
  'TestSidecarHTTPExecutorWithRealTransportPreservesRequestContract',
  'TestSidecarHTTPExecutorWithRealTransportClassifiesHTTPFailureTaxonomy',
  'TestSidecarHTTPExecutorWithRealTransportHonorsContextDeadline',
];
const command = [
  'test',
  '-count=1',
  '-tags',
  unrestrictedTag,
  pkg,
  '-run',
  '^(' + listenerRestrictedTests.join('|') + ')$',
];

const env = {
  ...process.env,
  GOCACHE: process.env.GOCACHE || '/private/tmp/gettokens-go-cache',
};

const listenerRestrictedSet = new Set(listenerRestrictedTests);
const listenRestrictionPatterns = [
  /httptest: failed to listen on a port/i,
  /httptest\.NewServer/i,
  /listen tcp6? \[::1\]:0: bind: operation not permitted/i,
  /listen tcp6? \[::1\]:0: bind: permission denied/i,
  /listen tcp6? 127\.0\.0\.1:0: bind: operation not permitted/i,
  /listen tcp6? 127\.0\.0\.1:0: bind: permission denied/i,
  /listen tcp6? localhost:0: bind: operation not permitted/i,
  /listen tcp6? localhost:0: bind: permission denied/i,
  /listen tcp6? .*:0: bind: operation not permitted/i,
  /listen tcp6? .*:0: bind: permission denied/i,
];

function trimOutput(value) {
  return (value || '').trim();
}

function extractFailedTests(output) {
  const failed = new Set();
  const failPattern = /^--- FAIL: (Test[^\s(]+)/gm;
  let match;
  while ((match = failPattern.exec(output)) !== null) {
    failed.add(match[1]);
  }
  return [...failed];
}

function hasListenRestriction(output) {
  return listenRestrictionPatterns.some((pattern) => pattern.test(output));
}

function excerptListenRestriction(output) {
  const lines = output.split(/\r?\n/);
  const matchedIndex = lines.findIndex((line) => hasListenRestriction(line));
  if (matchedIndex === -1) {
    return [];
  }
  const start = Math.max(0, matchedIndex - 2);
  const end = Math.min(lines.length, matchedIndex + 3);
  return lines.slice(start, end).map((line) => line.trim()).filter(Boolean);
}

function classify(result) {
  const stdout = trimOutput(result.stdout);
  const stderr = trimOutput(result.stderr);
  const combined = [stdout, stderr].filter(Boolean).join('\n');
  const failedTests = extractFailedTests(combined);
  const unknownFailedTests = failedTests.filter((test) => !listenerRestrictedSet.has(test));
  const stderrHasListenRestriction = hasListenRestriction(stderr);
  const outputHasListenRestriction = hasListenRestriction(combined);

  if (result.status === 0) {
    return {
      classification: 'passed',
      environment_conclusion: 'real_unrestricted_pass',
      real_unrestricted_pass: true,
      exit_code: 0,
      failed_tests: failedTests,
      stderr_has_localhost_listen_restriction: stderrHasListenRestriction,
      output_has_localhost_listen_restriction: outputHasListenRestriction,
    };
  }

  if (
    outputHasListenRestriction
    && unknownFailedTests.length === 0
    && failedTests.length > 0
    && failedTests.every((test) => listenerRestrictedSet.has(test))
  ) {
    return {
      classification: 'localhost_listen_restriction_only',
      environment_conclusion: 'localhost_listen_restriction_only',
      real_unrestricted_pass: false,
      exit_code: 0,
      failed_tests: failedTests,
      stderr_has_localhost_listen_restriction: stderrHasListenRestriction,
      output_has_localhost_listen_restriction: outputHasListenRestriction,
      evidence_excerpt: excerptListenRestriction(combined),
    };
  }

  return {
    classification: 'real_test_failure',
    environment_conclusion: 'real_test_failure',
    real_unrestricted_pass: false,
    exit_code: 1,
    failed_tests: failedTests,
    unknown_failed_tests: unknownFailedTests,
    stderr_has_localhost_listen_restriction: stderrHasListenRestriction,
    output_has_localhost_listen_restriction: outputHasListenRestriction,
  };
}

console.log('Running tagged unrestricted listener smoke: go ' + command.map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' '));
const result = spawnSync('go', command, {
  cwd: repoRoot,
  env,
  encoding: 'utf8',
});

const summary = {
  tag: unrestrictedTag,
  command: 'go ' + command.join(' '),
  package: pkg,
  go_exit_status: result.status ?? 1,
  listener_tests: listenerRestrictedTests,
  ...classify(result),
};

console.log(JSON.stringify(summary, null, 2));

if (summary.classification === 'passed') {
  const stdout = trimOutput(result.stdout);
  if (stdout) {
    console.log(stdout);
  }
}

if (summary.classification === 'localhost_listen_restriction_only') {
  console.log('[protocolbridge-unrestricted-smoke] classified as environment-only localhost listen restriction');
}

if (summary.classification === 'real_test_failure') {
  const stdout = trimOutput(result.stdout);
  const stderr = trimOutput(result.stderr);
  if (stdout) {
    console.error('\n[stdout]');
    console.error(stdout);
  }
  if (stderr) {
    console.error('\n[stderr]');
    console.error(stderr);
  }
}

process.exit(summary.exit_code);
