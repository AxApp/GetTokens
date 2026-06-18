#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.env.GETTOKENS_REPO_ROOT
  ? path.resolve(process.env.GETTOKENS_REPO_ROOT)
  : process.cwd();

const pkg = './internal/protocolbridge';
const noNetworkTag = 'protocolbridge_no_network';
const unrestrictedTag = 'protocolbridge_unrestricted_listener';

const env = {
  ...process.env,
  GOCACHE: process.env.GOCACHE || '/private/tmp/gettokens-go-cache',
};

const defaultPackageSuites = [
  {
    name: 'JSONL audit sink/reader',
    reason: 'uses t.TempDir JSONL only; no listener or sidecar endpoint',
    tests: [
      'TestJSONLAuditSinkPersistsRedactedEvents',
      'TestJSONLAuditSinkAppendsMultipleEvents',
      'TestJSONLAuditReaderQueriesByStatusKindAndLimit',
      'TestJSONLAuditReaderPaginatesByOffsetAndCursor',
      'TestJSONLAuditReaderRejectsInvalidPagination',
      'TestJSONLAuditReaderSkipsMalformedLines',
    ],
  },
  {
    name: 'MCP adapter/runtime authorization',
    reason: 'in-process runtime and stub executor only',
    tests: [
      'TestMCPAdapterReadToolAuthorizesThenExecutesCanonicalOperation',
      'TestMCPAdapterMissingScopeRejectsBeforeExecutor',
      'TestMCPAdapterPreflightRejectionPersistsAuditBeforeExecutor',
      'TestMCPAdapterSafeActionWithoutIdempotencyRejectsBeforeExecutor',
      'TestMCPAdapterSafeActionReturnsOperationRefOnly',
      'TestMCPAdapterExecutorErrorPersistsAuditWithoutChangingCanonicalFailure',
      'TestMCPAdapterUnknownToolAndResourceReject',
      'TestMCPAdapterResourceResponseExcludesForbiddenSecretMaterial',
      'TestAuthorizeRejectsMissingScopeWithoutSidecar',
      'TestAuthorizeEnforcesLoopbackOnlyCallerContext',
      'TestAuthorizeRequiresExactScopeAndDoesNotAllowWildcard',
      'TestAuthorizeActorScopesExcludeExpiredGrant',
      'TestAuthorizeRejectsDisabledExpiredAndTransportMismatch',
      'TestAuthorizeRejectsSafeActionWithoutIdempotencyKey',
      'TestAuthorizeSuccessReadAuthorityOwnerRemainsSidecar',
      'TestAuthorizeAuditDoesNotExposeRawTokenOrIdempotencyKey',
      'TestMCPAdapterMappingFixtureAlignsWithOperationSpecs',
    ],
  },
  {
    name: 'MCP stdio preflight',
    reason: 'fixture/schema validation before executor; no process listener',
    tests: [
      'TestMCPStdioPreflightAllowsOnlyFixtureToolsAndResources',
      'TestMCPStdioPreflightRejectsCredentialBearingInput',
      'TestMCPStdioPreflightRejectsToolQueryKeysOutsideCanonicalSchemaAllowlist',
      'TestMCPStdioPreflightRejectsMissingRequiredOrWrongTypedCanonicalQuery',
      'TestMCPStdioPreflightRejectsCanonicalQueryEnumValues',
      'TestMCPStdioPreflightAllowsCanonicalQueryTypesAndRequiredFields',
      'TestMCPAdapterStdioPreflightRejectsCredentialBearingToolInputBeforeExecutor',
      'TestMCPAdapterStdioPreflightRejectsMissingRequiredOrWrongTypedCanonicalQueryBeforeExecutor',
      'TestMCPAdapterStdioPreflightRejectsInvalidCanonicalQueryEnumBeforeExecutor',
      'TestMCPAdapterStdioPreflightAllowsValidCanonicalQueryEnumBeforeExecutor',
      'TestMCPAdapterStdioPreflightRejectsQueryKeysOutsideCanonicalSchemaBeforeExecutor',
      'TestMCPAdapterAuthorizeRunsBeforeSchemaValidationPreflight',
      'TestMCPAdapterAuthorizeRunsBeforeEnumValidationPreflight',
      'TestMCPAdapterStdioPreflightRejectsCredentialBearingResourceURI',
    ],
  },
  {
    name: 'MCP in-process JSON-RPC stdio',
    reason: 'bytes.Buffer reader/writer plus stub executor; covers initialize/list/resources',
    tests: [
      'TestMCPStdioJSONRPCHandlerToolsCallAuthorizesPreflightsAndExecutes',
      'TestMCPStdioJSONRPCHandlerInitializeReturnsMinimalCapabilities',
      'TestMCPStdioJSONRPCHandlerToolsListReturnsLocalManifestWithoutExecutor',
      'TestMCPStdioJSONRPCHandlerToolsListPaginatesLocalManifestWithoutExecutor',
      'TestMCPStdioJSONRPCHandlerResourcesListReturnsLocalManifestWithoutExecutor',
      'TestMCPStdioJSONRPCHandlerResourcesListPaginatesLocalManifestWithoutExecutor',
      'TestMCPStdioJSONRPCHandlerListRejectsInvalidPagination',
      'TestMCPStdioJSONRPCHandlerResourcesReadOnlyAllowsMappedFixtureURI',
      'TestMCPStdioJSONRPCHandlerRejectsCredentialAndSchemaOutsideQueryBeforeExecutor',
      'TestMCPStdioJSONRPCHandlerErrorResponsesDoNotEchoTokenHeaderOrCookie',
    ],
  },
  {
    name: 'MCP stdio lifecycle/external process wrapper',
    reason: 'local stdio pipes and helper process; no TCP listener',
    tests: [
      'TestMCPExternalStdioProcessStartsAndRoundTripsJSONRPC',
      'TestMCPExternalStdioProcessShutdownCancelsContextBoundProcess',
      'TestMCPExternalStdioProcessExitAndStderrErrorsAreRedacted',
      'TestMCPExternalStdioHelperProcess',
      'TestMCPStdioLifecycleWrapperServeStopsOnContextCancel',
      'TestMCPStdioLifecycleWrapperShutdownClosesRunningServe',
      'TestMCPStdioLifecycleWrapperMalformedRequestDoesNotLeakSecrets',
    ],
  },
  {
    name: 'Sidecar HTTP boundary without listeners',
    reason: 'invalid endpoint checks or fake SidecarTransport; no httptest.NewServer',
    tests: [
      'TestNewSidecarHTTPExecutorFromEndpointRejectsInvalidEndpoint',
      'TestSidecarHTTPExecutorFromEndpointRejectsAuthorityMismatchBeforeSidecar',
      'TestNewSidecarHTTPTransportRejectsInvalidBaseURL',
      'TestSidecarHTTPExecutorMapsReadOperationToSidecarRequest',
      'TestSidecarHTTPExecutorMapsSafeActionToAcceptedOperationRefAndHashesIdempotency',
      'TestMCPAdapterWithSidecarHTTPExecutorAuthorizesThenInvokesSidecarTransport',
      'TestMCPAdapterMissingScopeDoesNotReachSidecarTransport',
      'TestSidecarHTTPExecutorClassifiesFailureTaxonomy',
      'TestMCPAdapterWithSidecarHTTPExecutorProjectsCanonicalFailureTaxonomy',
    ],
  },
];

const noNetworkTagOnlySuites = [
  {
    name: 'Build-tag package verifier',
    reason: 'explicit protocolbridge_no_network smoke over cross-cutting local paths',
    tests: [
      'TestProtocolBridgeNoNetworkVerifier',
    ],
  },
];

const unrestrictedSuites = [
  {
    name: 'httptest listener / real HTTP transport',
    reason: 'tagged protocolbridge_unrestricted_listener and requires localhost port binding outside this sandbox',
    tests: [
      'TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface',
      'TestSidecarHTTPExecutorWithRealTransportPreservesRequestContract',
      'TestSidecarHTTPExecutorWithRealTransportClassifiesHTTPFailureTaxonomy',
      'TestSidecarHTTPExecutorWithRealTransportHonorsContextDeadline',
    ],
  },
];

function flattenSuites(suites) {
  return suites.flatMap((suite) => suite.tests);
}

function unique(values) {
  return [...new Set(values)];
}

function regexpEscape(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function runGo(args, label) {
  const result = spawnSync('go', args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  return {
    label,
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function parseTests(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Test'));
}

function printSuite(title, suites) {
  const count = flattenSuites(suites).length;
  console.log(`${title} (${count})`);
  for (const suite of suites) {
    console.log(`  - ${suite.name}: ${suite.tests.length}`);
    console.log(`    reason: ${suite.reason}`);
    for (const test of suite.tests) {
      console.log(`    - ${test}`);
    }
  }
}

function fail(step, details) {
  console.error(`\n[protocolbridge-no-network] ${step} failed`);
  console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

const defaultPackageTests = unique(flattenSuites(defaultPackageSuites));
const noNetworkTagOnlyTests = unique(flattenSuites(noNetworkTagOnlySuites));
const unrestrictedTests = unique(flattenSuites(unrestrictedSuites));

for (const [left, right, reason] of [
  [defaultPackageTests, noNetworkTagOnlyTests, 'default package vs no-network tag-only'],
  [defaultPackageTests, unrestrictedTests, 'default package vs unrestricted listener'],
  [noNetworkTagOnlyTests, unrestrictedTests, 'no-network tag-only vs unrestricted listener'],
]) {
  const overlap = left.filter((test) => right.includes(test));
  if (overlap.length > 0) {
    fail('suite split validation', { reason, overlap });
  }
}

const defaultList = runGo(['test', pkg, '-list', '^Test'], 'discover default package tests');
if (defaultList.status !== 0) {
  fail(defaultList.label, {
    command: `go test ${pkg} -list '^Test'`,
    stdout: defaultList.stdout.trim(),
    stderr: defaultList.stderr.trim(),
  });
}

const noNetworkTagList = runGo(['test', '-tags', noNetworkTag, pkg, '-list', '^Test'], 'discover no-network tag tests');
if (noNetworkTagList.status !== 0) {
  fail(noNetworkTagList.label, {
    command: `go test -tags ${noNetworkTag} ${pkg} -list '^Test'`,
    stdout: noNetworkTagList.stdout.trim(),
    stderr: noNetworkTagList.stderr.trim(),
  });
}

const unrestrictedTagList = runGo(['test', '-tags', unrestrictedTag, pkg, '-list', '^Test'], 'discover unrestricted listener tests');
if (unrestrictedTagList.status !== 0) {
  fail(unrestrictedTagList.label, {
    command: `go test -tags ${unrestrictedTag} ${pkg} -list '^Test'`,
    stdout: unrestrictedTagList.stdout.trim(),
    stderr: unrestrictedTagList.stderr.trim(),
  });
}

const discoveredDefault = parseTests(defaultList.stdout);
const discoveredNoNetworkTag = parseTests(noNetworkTagList.stdout);
const discoveredUnrestrictedTag = parseTests(unrestrictedTagList.stdout);

const defaultSet = new Set(defaultPackageTests);
const noNetworkTagOnlySet = new Set(noNetworkTagOnlyTests);
const unrestrictedSet = new Set(unrestrictedTests);

const missingDefault = defaultPackageTests.filter((test) => !discoveredDefault.includes(test));
const leakedNoNetworkTagOnlyIntoDefault = discoveredDefault.filter((test) => noNetworkTagOnlySet.has(test));
const leakedUnrestrictedIntoDefault = discoveredDefault.filter((test) => unrestrictedSet.has(test));
const unexpectedDefault = discoveredDefault.filter((test) => !defaultSet.has(test));

const missingDefaultFromNoNetworkTag = defaultPackageTests.filter((test) => !discoveredNoNetworkTag.includes(test));
const missingNoNetworkTagOnly = noNetworkTagOnlyTests.filter((test) => !discoveredNoNetworkTag.includes(test));
const unexpectedNoNetworkTag = discoveredNoNetworkTag.filter((test) => !defaultSet.has(test) && !noNetworkTagOnlySet.has(test));

const missingDefaultFromUnrestrictedTag = defaultPackageTests.filter((test) => !discoveredUnrestrictedTag.includes(test));
const missingUnrestricted = unrestrictedTests.filter((test) => !discoveredUnrestrictedTag.includes(test));
const unexpectedUnrestrictedTag = discoveredUnrestrictedTag.filter((test) => !defaultSet.has(test) && !unrestrictedSet.has(test));

if (
  missingDefault.length > 0
  || leakedNoNetworkTagOnlyIntoDefault.length > 0
  || leakedUnrestrictedIntoDefault.length > 0
  || unexpectedDefault.length > 0
  || missingDefaultFromNoNetworkTag.length > 0
  || missingNoNetworkTagOnly.length > 0
  || unexpectedNoNetworkTag.length > 0
  || missingDefaultFromUnrestrictedTag.length > 0
  || missingUnrestricted.length > 0
  || unexpectedUnrestrictedTag.length > 0
) {
  fail('suite split discovery', {
    reason: 'protocolbridge tests must stay explicitly partitioned across default package, no-network tag, and unrestricted listener tag',
    missing_default: missingDefault,
    leaked_no_network_tag_only_into_default: leakedNoNetworkTagOnlyIntoDefault,
    leaked_unrestricted_into_default: leakedUnrestrictedIntoDefault,
    unexpected_default: unexpectedDefault,
    missing_default_from_no_network_tag: missingDefaultFromNoNetworkTag,
    missing_no_network_tag_only: missingNoNetworkTagOnly,
    unexpected_no_network_tag: unexpectedNoNetworkTag,
    missing_default_from_unrestricted_tag: missingDefaultFromUnrestrictedTag,
    missing_unrestricted: missingUnrestricted,
    unexpected_unrestricted_tag: unexpectedUnrestrictedTag,
  });
}

printSuite('Default package gate tests', defaultPackageSuites);
console.log('');
printSuite('No-network tag-only verifier', noNetworkTagOnlySuites);
console.log('');
printSuite('Requires unrestricted listener tag', unrestrictedSuites);
console.log('');
console.log(`Default package gate: GOCACHE=${env.GOCACHE} go test -count=1 ${pkg}`);
console.log(`Tagged no-network verifier: GOCACHE=${env.GOCACHE} go test -count=1 -tags ${noNetworkTag} ${pkg} -run '^TestProtocolBridgeNoNetworkVerifier$'`);
console.log(`Tagged unrestricted listener smoke: node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs`);
console.log('');

const defaultCommand = ['test', '-count=1', pkg];
console.log(`Running default package gate: go ${defaultCommand.join(' ')}`);
const defaultRun = runGo(defaultCommand, 'run default package gate');
if (defaultRun.status !== 0) {
  fail(defaultRun.label, {
    command: `go ${defaultCommand.join(' ')}`,
    stdout: defaultRun.stdout.trim(),
    stderr: defaultRun.stderr.trim(),
  });
}

const verifierPattern = `^(${noNetworkTagOnlyTests.map(regexpEscape).join('|')})$`;
const verifierCommand = ['test', '-count=1', '-tags', noNetworkTag, pkg, '-run', verifierPattern];
console.log(`Running tagged no-network verifier: go ${verifierCommand.map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ')}`);
const verifierRun = runGo(verifierCommand, 'run tagged no-network verifier');
if (verifierRun.status !== 0) {
  fail(verifierRun.label, {
    command: `go ${verifierCommand.join(' ')}`,
    stdout: verifierRun.stdout.trim(),
    stderr: verifierRun.stderr.trim(),
  });
}

console.log('');
console.log('[protocolbridge-no-network] ok');
console.log(defaultRun.stdout.trim());
console.log(verifierRun.stdout.trim());
