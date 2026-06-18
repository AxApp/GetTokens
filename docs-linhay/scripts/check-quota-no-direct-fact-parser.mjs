#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultRepoRoot = process.env.GETTOKENS_REPO_ROOT
  ? path.resolve(process.env.GETTOKENS_REPO_ROOT)
  : process.cwd();
const scannedRoot = 'frontend/src/features';
const directParserEntrypoint = 'frontend/src/features/accounts/model/accountQuota.ts';

const canonicalParserFiles = [
  /^frontend\/src\/features\/accounts\/model\/accountQuota\.ts$/,
];

const fixtureAllowlist = [
  /^frontend\/src\/features\/accounts\/tests\//,
  /^frontend\/src\/features\/status\/tests\//,
  /^frontend\/src\/features\/doctor-workbench\/tests\//,
  /^frontend\/src\/features\/accounts\/previewData\.ts$/,
  /^frontend\/src\/features\/doctor-workbench\/model\/previewData\.ts$/,
];

const knownTypedConsumerExceptions = [];

const quotaFactKeys = new Set(['quotaFact', 'quota_fact', 'fact']);
const rawQuotaPayloadKeys = new Set(['originalMessage', 'rawPayload']);
const allForbiddenKeys = new Set([...quotaFactKeys, ...rawQuotaPayloadKeys]);

function toRepoRelative(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isScannableFile(filePath) {
  return /\.(?:ts|tsx|mjs|js)$/.test(filePath);
}

function isAllowedFixture(relPath) {
  return fixtureAllowlist.some((pattern) => pattern.test(relPath));
}

function isKnownTypedConsumerException(relPath) {
  return knownTypedConsumerExceptions.some((pattern) => pattern.test(relPath));
}

function isCanonicalParserFile(relPath) {
  return canonicalParserFiles.some((pattern) => pattern.test(relPath));
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(nextPath));
      continue;
    }
    if (entry.isFile() && isScannableFile(nextPath)) {
      files.push(nextPath);
    }
  }
  return files;
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function advancePosition(state, text) {
  for (const char of text) {
    if (char === '\n') {
      state.line += 1;
      state.column = 1;
    } else {
      state.column += 1;
    }
  }
}

function readQuotedString(source, start) {
  const quote = source[start];
  let index = start + 1;
  let escaped = false;
  while (index < source.length) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      index += 1;
      continue;
    }
    if (char === quote) {
      index += 1;
      break;
    }
    index += 1;
  }
  return source.slice(start, index);
}

function readTemplateString(source, start) {
  let index = start + 1;
  let escaped = false;
  while (index < source.length) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      index += 1;
      continue;
    }
    if (char === '`') {
      index += 1;
      break;
    }
    index += 1;
  }
  return source.slice(start, index);
}

function decodeStringLiteral(raw) {
  if (!raw || raw.length < 2) {
    return '';
  }
  const quote = raw[0];
  if (quote === '`') {
    return raw.slice(1, raw.endsWith('`') ? -1 : undefined);
  }
  const body = raw.slice(1, raw.endsWith(quote) ? -1 : undefined);
  return body.replace(/\\(['"`\\])/g, '$1');
}

function tokenize(source) {
  const tokens = [];
  const state = { line: 1, column: 1 };
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (/\s/.test(char)) {
      advancePosition(state, char);
      index += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      const raw = source.slice(index, end === -1 ? source.length : end);
      advancePosition(state, raw);
      index += raw.length;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const raw = source.slice(index, end === -1 ? source.length : end + 2);
      advancePosition(state, raw);
      index += raw.length;
      continue;
    }

    if (char === '"' || char === "'") {
      const raw = readQuotedString(source, index);
      tokens.push({
        type: 'string',
        value: decodeStringLiteral(raw),
        raw,
        line: state.line,
        column: state.column,
      });
      advancePosition(state, raw);
      index += raw.length;
      continue;
    }

    if (char === '`') {
      const raw = readTemplateString(source, index);
      tokens.push({
        type: 'string',
        value: decodeStringLiteral(raw),
        raw,
        line: state.line,
        column: state.column,
      });
      advancePosition(state, raw);
      index += raw.length;
      continue;
    }

    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < source.length && isIdentifierPart(source[end])) {
        end += 1;
      }
      const raw = source.slice(index, end);
      tokens.push({
        type: 'identifier',
        value: raw,
        raw,
        line: state.line,
        column: state.column,
      });
      advancePosition(state, raw);
      index = end;
      continue;
    }

    tokens.push({
      type: 'punct',
      value: char,
      raw: char,
      line: state.line,
      column: state.column,
    });
    advancePosition(state, char);
    index += 1;
  }

  return tokens;
}

function lineSnippet(lines, token) {
  return (lines[token.line - 1] || '').trim();
}

function ruleForKey(key, accessKind = 'property') {
  if (rawQuotaPayloadKeys.has(key)) {
    return accessKind === 'destructuring'
      ? 'raw quota payload destructuring'
      : 'raw quota payload access';
  }
  if (key === 'quotaFact') {
    return accessKind === 'bracket' ? 'quotaFact bracket access' : 'quotaFact property access';
  }
  if (key === 'quota_fact') {
    return 'quota_fact parser access';
  }
  return accessKind === 'destructuring' ? 'legacy fact destructuring' : 'legacy fact parser access';
}

function createFindingSink(relPath, lines) {
  const findings = [];
  const seen = new Set();
  return {
    add(token, rule, fallbackSnippet) {
      const line = token?.line || 1;
      const snippet = token ? lineSnippet(lines, token) : fallbackSnippet || '';
      const key = `${line}:${rule}:${snippet}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      findings.push({
        file: relPath,
        line,
        rule,
        snippet,
      });
    },
    list() {
      return findings;
    },
  };
}

function tokenValue(tokens, index) {
  return tokens[index]?.value;
}

function tokenType(tokens, index) {
  return tokens[index]?.type;
}

function findClosing(tokens, openIndex, openValue, closeValue) {
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === openValue) {
      depth += 1;
      continue;
    }
    if (tokens[index].value === closeValue) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findStatementEnd(tokens, start) {
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const value = tokens[index].value;
    if (value === '(') parenDepth += 1;
    if (value === ')') parenDepth -= 1;
    if (value === '[') bracketDepth += 1;
    if (value === ']') bracketDepth -= 1;
    if (value === '{') braceDepth += 1;
    if (value === '}') braceDepth -= 1;
    if (parenDepth <= 0 && bracketDepth <= 0 && braceDepth <= 0 && (value === ';' || value === ',')) {
      return index;
    }
  }
  return tokens.length;
}

function tokenSliceContainsRawPayloadAccess(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === '.' && rawQuotaPayloadKeys.has(tokenValue(tokens, index + 1))) {
      return true;
    }
    if (
      tokens[index].value === '['
      && tokenType(tokens, index + 1) === 'string'
      && rawQuotaPayloadKeys.has(tokenValue(tokens, index + 1))
    ) {
      return true;
    }
  }
  return false;
}

function collectRawPayloadAliases(tokens) {
  const aliases = new Set([...rawQuotaPayloadKeys]);

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === '{') {
      const closeIndex = findClosing(tokens, index, '{', '}');
      if (closeIndex === -1) {
        continue;
      }
      const nextValue = tokenValue(tokens, closeIndex + 1);
      const isDestructuring = nextValue === '=' || nextValue === ')';
      if (!isDestructuring) {
        continue;
      }
      for (let cursor = index + 1; cursor < closeIndex; cursor += 1) {
        const keyToken = tokens[cursor];
        if (!['identifier', 'string'].includes(keyToken.type) || !rawQuotaPayloadKeys.has(keyToken.value)) {
          continue;
        }
        if (tokenValue(tokens, cursor + 1) === ':' && tokenType(tokens, cursor + 2) === 'identifier') {
          aliases.add(tokenValue(tokens, cursor + 2));
        } else {
          aliases.add(keyToken.value);
        }
      }
    }

    if (!['const', 'let', 'var'].includes(tokens[index].value)) {
      continue;
    }
    const aliasToken = tokens[index + 1];
    if (aliasToken?.type !== 'identifier' || tokenValue(tokens, index + 2) !== '=') {
      continue;
    }
    const endIndex = findStatementEnd(tokens, index + 3);
    const valueTokens = tokens.slice(index + 3, endIndex);
    if (tokenSliceContainsRawPayloadAccess(valueTokens) || valueTokens.some((token) => aliases.has(token.value))) {
      aliases.add(aliasToken.value);
    }
  }

  return aliases;
}

function scanPropertyAndBracketAccess(tokens, sink) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === '.' && allForbiddenKeys.has(tokenValue(tokens, index + 1))) {
      const key = tokenValue(tokens, index + 1);
      sink.add(tokens[index + 1], ruleForKey(key, 'property'));
      continue;
    }

    if (
      token.value === '['
      && tokenType(tokens, index + 1) === 'string'
      && allForbiddenKeys.has(tokenValue(tokens, index + 1))
      && tokenValue(tokens, index + 2) === ']'
    ) {
      const key = tokenValue(tokens, index + 1);
      sink.add(tokens[index + 1], ruleForKey(key, 'bracket'));
    }
  }
}

function scanDestructuring(tokens, sink) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== '{') {
      continue;
    }
    const closeIndex = findClosing(tokens, index, '{', '}');
    if (closeIndex === -1) {
      continue;
    }
    const nextValue = tokenValue(tokens, closeIndex + 1);
    const isDestructuring = nextValue === '=' || nextValue === ')';
    if (!isDestructuring) {
      continue;
    }
    for (let cursor = index + 1; cursor < closeIndex; cursor += 1) {
      const token = tokens[cursor];
      if (!['identifier', 'string'].includes(token.type) || !allForbiddenKeys.has(token.value)) {
        continue;
      }
      const next = tokenValue(tokens, cursor + 1);
      if (next === ':' || next === ',' || next === '}' || next === '=') {
        sink.add(token, ruleForKey(token.value, 'destructuring'));
      }
    }
  }
}

function scanJsonParse(tokens, rawAliases, sink) {
  for (let index = 0; index < tokens.length; index += 1) {
    const isJsonParseCall = tokenValue(tokens, index) === 'JSON'
      && tokenValue(tokens, index + 1) === '.'
      && tokenValue(tokens, index + 2) === 'parse'
      && tokenValue(tokens, index + 3) === '(';
    if (!isJsonParseCall) {
      continue;
    }

    const openIndex = index + 3;
    const closeIndex = findClosing(tokens, openIndex, '(', ')');
    if (closeIndex === -1) {
      continue;
    }

    const argTokens = tokens.slice(openIndex + 1, closeIndex);
    const readsRawPayload = argTokens.some((token) => token.type === 'identifier' && rawAliases.has(token.value))
      || tokenSliceContainsRawPayloadAccess(argTokens);
    if (readsRawPayload) {
      sink.add(tokens[index + 2], 'JSON.parse raw quota payload');
    }

    let nextIndex = closeIndex + 1;
    if (tokenValue(tokens, nextIndex) === '?') {
      nextIndex += 1;
    }
    if (tokenValue(tokens, nextIndex) === '.' && quotaFactKeys.has(tokenValue(tokens, nextIndex + 1))) {
      sink.add(tokens[nextIndex + 1], 'JSON.parse direct quota fact extraction');
    }
    if (
      tokenValue(tokens, nextIndex) === '['
      && tokenType(tokens, nextIndex + 1) === 'string'
      && quotaFactKeys.has(tokenValue(tokens, nextIndex + 1))
    ) {
      sink.add(tokens[nextIndex + 1], 'JSON.parse direct quota fact extraction');
    }
  }
}

export function findDirectParserLines(relPath, source) {
  if (isCanonicalParserFile(relPath) || isAllowedFixture(relPath) || isKnownTypedConsumerException(relPath)) {
    return [];
  }

  const lines = source.split(/\r?\n/);
  const tokens = tokenize(source);
  const sink = createFindingSink(relPath, lines);
  const rawAliases = collectRawPayloadAliases(tokens);

  scanPropertyAndBracketAccess(tokens, sink);
  scanDestructuring(tokens, sink);
  scanJsonParse(tokens, rawAliases, sink);

  return sink.list();
}

export async function runQuotaGate(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || defaultRepoRoot);
  const scanRootAbs = path.resolve(repoRoot, scannedRoot);
  const files = await walk(scanRootAbs);
  const findings = [];
  let checkedFiles = 0;
  let fixtureFiles = 0;
  let exceptionFiles = 0;
  let canonicalFiles = 0;

  for (const filePath of files) {
    const relPath = toRepoRelative(repoRoot, filePath);
    const source = await readFile(filePath, 'utf8');
    if (isAllowedFixture(relPath)) {
      fixtureFiles += 1;
    }
    if (isKnownTypedConsumerException(relPath)) {
      exceptionFiles += 1;
    }
    if (isCanonicalParserFile(relPath)) {
      canonicalFiles += 1;
    }
    checkedFiles += 1;
    findings.push(...findDirectParserLines(relPath, source));
  }

  return {
    ok: findings.length === 0,
    scannedRoot,
    checkedFiles,
    fixtureFiles,
    exceptionFiles,
    canonicalFiles,
    directParserEntrypoint,
    canonicalParserFiles: canonicalParserFiles.map((pattern) => pattern.source),
    allowedFixtureRoots: fixtureAllowlist.map((pattern) => pattern.source),
    knownTypedConsumerExceptions: knownTypedConsumerExceptions.map((pattern) => pattern.source),
    scanner: {
      mode: 'lexical-light-ast',
      ignoresCommentsAndStrings: true,
      scannedForms: [
        'property-access',
        'bracket-access',
        'object-destructuring',
        'raw-payload-alias',
        'JSON.parse',
      ],
    },
    findings,
  };
}

async function main() {
  const result = await runQuotaGate();
  const output = JSON.stringify(result, null, 2);
  if (!result.ok) {
    console.error(output);
    process.exit(1);
  }
  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
