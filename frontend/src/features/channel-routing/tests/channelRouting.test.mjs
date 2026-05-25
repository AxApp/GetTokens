import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHANNEL_ROUTE_MODES,
  classifyChannelRouteMode,
  isChannelRouteMode,
  normalizeChannelRoutingConfig,
  updateChannelRoutingConfig,
} from '../model/channelRouting.ts';

test('ChannelRouteMode only accepts the GetTokens three-mode routing model', () => {
  assert.deepEqual([...CHANNEL_ROUTE_MODES], ['sequential', 'balanced', 'project']);
  assert.equal(isChannelRouteMode('sequential'), true);
  assert.equal(isChannelRouteMode('balanced'), true);
  assert.equal(isChannelRouteMode('project'), true);

  ['dedicated', 'prefer', 'ordered', 'weighted', 'canary', 'exclude', 'round-robin'].forEach((mode) => {
    assert.equal(isChannelRouteMode(mode), false, mode);
  });
});

test('classifyChannelRouteMode separates upstream compatibility modes from GetTokens route modes', () => {
  assert.deepEqual(classifyChannelRouteMode('balanced'), { kind: 'gettokens', mode: 'balanced' });
  assert.deepEqual(classifyChannelRouteMode('weighted'), { kind: 'upstream-compat', mode: 'weighted' });
  assert.deepEqual(classifyChannelRouteMode('exclude'), { kind: 'invalid', mode: 'exclude' });
});

test('normalizeChannelRoutingConfig keeps upstream modes out of saved channel config', () => {
  const { config, ignoredUpstreamModes, invalidModes } = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'weighted',
      orderedAccountIDs: ['auth-file:a.json', 'auth-file:a.json', ' ', 'codex-api-key:stable'],
      projectModeFallbackRouteMode: 'canary',
      fallbackMode: 'fallback-default',
    },
    { channel: 'codex' },
  );

  assert.equal(config.channel, 'codex');
  assert.equal(config.routeMode, 'sequential');
  assert.equal(config.projectModeFallbackRouteMode, 'sequential');
  assert.equal(config.shadowRouteMode, 'balanced');
  assert.deepEqual(config.orderedAccountIDs, ['auth-file:a.json', 'codex-api-key:stable']);
  assert.deepEqual(ignoredUpstreamModes, ['weighted', 'canary']);
  assert.deepEqual(invalidModes, []);
});

test('normalizeChannelRoutingConfig keeps shadow mode explicit and separate from production route mode', () => {
  const normalized = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'sequential',
      shadowEnabled: true,
      shadowRouteMode: 'balanced',
    },
    { channel: 'codex' },
  );

  assert.equal(normalized.config.routeMode, 'sequential');
  assert.equal(normalized.config.shadowEnabled, true);
  assert.equal(normalized.config.shadowRouteMode, 'balanced');
  assert.deepEqual(normalized.ignoredUpstreamModes, []);
  assert.deepEqual(normalized.invalidModes, []);
});

test('project mode group fallback only allows sequential or balanced', () => {
  assert.equal(
    normalizeChannelRoutingConfig(
      {
        routeMode: 'project',
        projectModeFallbackRouteMode: 'balanced',
      },
      { channel: 'claude' },
    ).config.projectModeFallbackRouteMode,
    'balanced',
  );

  const normalized = normalizeChannelRoutingConfig(
    {
      routeMode: 'project',
      projectModeFallbackRouteMode: 'project',
    },
    { channel: 'claude' },
  );

  assert.equal(normalized.config.projectModeFallbackRouteMode, 'sequential');
  assert.deepEqual(normalized.invalidModes, ['project']);
});

test('Codex and Claude channel routing configs stay isolated when patched', () => {
  const codex = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'sequential',
      orderedAccountIDs: ['auth-file:codex.json'],
      channelGroupStates: {
        shared: { enabled: true, routeOrder: 1 },
      },
    },
    { channel: 'codex' },
  ).config;
  const claude = normalizeChannelRoutingConfig(
    {
      channel: 'claude',
      routeMode: 'balanced',
      orderedAccountIDs: ['openai-compatible:anthropic'],
      channelGroupStates: {
        shared: { enabled: true, routeOrder: 2 },
      },
    },
    { channel: 'claude' },
  ).config;

  const nextCodex = updateChannelRoutingConfig(codex, {
    routeMode: 'project',
    channelGroupStates: {
      shared: { enabled: false, routeOrder: 9 },
    },
  });

  assert.equal(nextCodex.channel, 'codex');
  assert.equal(nextCodex.routeMode, 'project');
  assert.deepEqual(nextCodex.channelGroupStates.shared, { enabled: false, routeOrder: 9 });
  assert.equal(claude.channel, 'claude');
  assert.equal(claude.routeMode, 'balanced');
  assert.deepEqual(claude.channelGroupStates.shared, { enabled: true, routeOrder: 2 });
});

test('normalizeChannelRoutingConfig trims project bindings and defaults invalid fallback', () => {
  const normalized = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'project',
      projectBindings: [
        {
          projectName: ' gettokens ',
          targetType: 'group',
          targetID: ' codex-pro ',
          fallbackMode: 'fallback-global',
        },
        {
          projectName: 'gettokens',
          targetType: 'account',
          targetID: 'auth-file:duplicate.json',
          fallbackMode: 'fallback-default',
        },
        {
          projectName: 'broken',
          targetType: 'invalid',
          targetID: 'auth-file:broken.json',
          fallbackMode: 'fallback-default',
        },
      ],
    },
    { channel: 'codex' },
  );

  assert.deepEqual(normalized.config.projectBindings, [
    {
      projectName: 'gettokens',
      targetType: 'group',
      targetID: 'codex-pro',
      fallbackMode: 'fallback-global',
    },
  ]);
});
