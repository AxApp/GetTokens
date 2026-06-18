#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const checkerPath = path.join(
  repoRoot,
  "docs-linhay",
  "references",
  "CLIProxyAPI",
  "scripts",
  "check-sidecar-smoke-manifest.mjs",
);
const fixturePath = path.join(
  repoRoot,
  "docs-linhay",
  "references",
  "CLIProxyAPI",
  "fixtures",
  "sidecar-smoke",
  "cli-proxy-api-round26-smoke-manifest.fixture.json",
);
const execFileAsync = promisify(execFile);

const [checkerSource, fixtureSource] = await Promise.all([
  readFile(checkerPath, "utf8"),
  readFile(fixturePath, "utf8"),
]);
const fixture = JSON.parse(fixtureSource);

assert.match(
  checkerSource,
  /sourceStateComparison/,
  "checker must require machine-readable clean/dirty comparison metadata",
);
assert.equal(fixture.sourceState?.classification, "dirty-source");
assert.equal(fixture.sourceState?.clean, false);
assert.equal(fixture.sourceState?.dirtyStatusEvidenceOnly, true);
assert.equal(fixture.sourceState?.artifactClass, "volatile-test-binary");
assert.equal(fixture.sourceStateComparison?.mode, "dirty-with-clean-comparison");
assert.equal(fixture.sourceStateComparison?.cleanComparisonAvailable, true);
assert.equal(fixture.sourceStateComparison?.sameCommit, true);
assert.match(fixture.sourceStateComparison?.cleanManifestPath || "", /clean-comparison-manifest\.json$/);
assert.match(fixture.sourceStateComparison?.cleanSourceStateHash || "", /^[a-f0-9]{64}$/);
assert.match(fixture.sourceStateComparison?.cleanBinarySha256 || "", /^[a-f0-9]{64}$/);

{
  const result = await execFileAsync(process.execPath, [checkerPath, "fixture"], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.match(result.stdout, /manifest ok/);
  assert.match(result.stdout, /sourceStateClassification=dirty-source/);
  assert.match(result.stdout, /artifactClass=volatile-test-binary/);
  assert.match(result.stdout, /cleanComparisonAvailable=true/);
}

const tmpRoot = await mkdtemp(path.join(tmpdir(), "gettokens-sidecar-clean-comparison-"));
try {
  const invalidPath = path.join(tmpRoot, "missing-source-state-comparison.json");
  const invalidManifest = JSON.parse(fixtureSource);
  delete invalidManifest.sourceStateComparison;
  await writeFile(invalidPath, JSON.stringify(invalidManifest, null, 2));
  await assert.rejects(
    execFileAsync(process.execPath, [checkerPath, invalidPath], {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
    }),
    (error) => {
      assert.match(String(error.stderr || ""), /sourceStateComparison/);
      return true;
    },
  );
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}

console.log("Sidecar smoke clean comparison policy passed.");
