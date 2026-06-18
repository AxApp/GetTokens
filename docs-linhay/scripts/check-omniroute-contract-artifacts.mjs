#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

const extensionRoot = path.join(repoRoot, "docs-linhay/spaces/20260616-extension-contract-v0");
const protocolRoot = path.join(repoRoot, "docs-linhay/spaces/20260616-protocol-bridge-surfaces");

const extensionPhase1Plan = path.join(
  extensionRoot,
  "plans/20260616-phase1-readonly-registry-implementation-plan.md",
);
const extensionReadme = path.join(extensionRoot, "README.md");
const extensionArtifactsPlan = path.join(
  extensionRoot,
  "plans/20260616-extension-contract-v0-artifacts-plan.md",
);
const extensionEnableStatePlan = path.join(
  extensionRoot,
  "plans/20260617-round12-enable-state-contract.md",
);
const extensionManifestSchemaGatePlan = path.join(
  extensionRoot,
  "plans/20260617-round15-extension-manifest-schema-gate.md",
);
const protocolScopedAuthPlan = path.join(
  protocolRoot,
  "plans/20260616-scoped-auth-audit-runtime-plan-v01.md",
);
const protocolRound14Plan = path.join(
  protocolRoot,
  "plans/20260617-round14-stdio-transport-preflight.md",
);

const expectedExtensionCapabilities = [
  "provider-metadata",
  "model-catalog-source",
  "account-importer",
  "quota-probe",
];

const expectedEnableStates = [
  "enabled",
  "disabled",
  "blocked",
  "pending",
  "readonly-unsupported",
];

const expectedEnableActionAvailability = ["read-only", "disabled"];

const expectedProtocolScopes = [
  "bridge.accounts.read",
  "bridge.models.read",
  "bridge.routes.diagnostics.read",
  "bridge.quota.read",
  "bridge.actions.routeability_recheck",
  "bridge.actions.quota_refresh",
  "bridge.actions.model_catalog_refresh",
  "bridge.actions.diagnostics_probe",
  "bridge.config.read",
  "bridge.config.write",
];

const requiredForbiddenBridgeState = [
  "candidate pool",
  "selected account",
  "route guard state",
  "session affinity",
  "quota-empty block",
  "model availability truth",
  "requestable truth",
  "live session pin",
];

const checks = [];

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function pass(name) {
  checks.push({ ok: true, name });
}

function fail(name, details) {
  checks.push({ ok: false, name, details });
}

function assertCheck(condition, name, details) {
  if (condition) {
    pass(name);
  } else {
    fail(name, details);
  }
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    throw new Error(`${relative(filePath)} is not valid JSON: ${error.message}`);
  }
}

function listJsonFiles(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listJsonFiles(fullPath));
    } else if (entry.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function includesAll(values, expected) {
  const set = new Set(values);
  return expected.every((value) => set.has(value));
}

function getArray(value, pathLabel) {
  if (!Array.isArray(value)) {
    throw new Error(`${pathLabel} must be an array`);
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function joinSchemaPath(basePath, segment) {
  return basePath === "#" ? `#/${segment}` : `${basePath}/${segment}`;
}

function joinDataPath(basePath, segment) {
  return basePath === "$" ? `${basePath}.${segment}` : `${basePath}.${segment}`;
}

function formatValue(value) {
  return JSON.stringify(value);
}

function hasObjectKeywords(schema) {
  return (
    Array.isArray(schema?.required) ||
    isPlainObject(schema?.properties) ||
    Object.prototype.hasOwnProperty.call(schema ?? {}, "additionalProperties") ||
    typeof schema?.minProperties === "number"
  );
}

function resolveSchemaRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`unsupported schema ref: ${ref}`);
  }

  let current = rootSchema;
  for (const rawSegment of ref.slice(2).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    current = current?.[segment];
  }

  if (current === undefined) {
    throw new Error(`unresolved schema ref: ${ref}`);
  }

  return current;
}

function validateAgainstSchema(rootSchema, schema, value, schemaPath = "#", dataPath = "$") {
  const errors = [];

  if (schema?.$ref) {
    return validateAgainstSchema(rootSchema, resolveSchemaRef(rootSchema, schema.$ref), value, schema.$ref, dataPath);
  }

  if (Array.isArray(schema?.allOf)) {
    for (const [index, itemSchema] of schema.allOf.entries()) {
      errors.push(
        ...validateAgainstSchema(
          rootSchema,
          itemSchema,
          value,
          joinSchemaPath(schemaPath, `allOf/${index}`),
          dataPath,
        ),
      );
    }
  }

  if (Array.isArray(schema?.anyOf)) {
    const branchResults = schema.anyOf.map((itemSchema, index) => ({
      index,
      errors: validateAgainstSchema(
        rootSchema,
        itemSchema,
        value,
        joinSchemaPath(schemaPath, `anyOf/${index}`),
        dataPath,
      ),
    }));
    const passingBranches = branchResults.filter((result) => result.errors.length === 0);
    if (passingBranches.length === 0) {
      const bestBranch = branchResults.reduce((best, current) =>
        current.errors.length < best.errors.length ? current : best,
      );
      errors.push(
        `${dataPath} must match at least one schema in anyOf (${bestBranch.errors.join("; ") || "no matching branch"})`,
      );
      return errors;
    }
  }

  if (Array.isArray(schema?.oneOf)) {
    const branchResults = schema.oneOf.map((itemSchema, index) => ({
      index,
      errors: validateAgainstSchema(
        rootSchema,
        itemSchema,
        value,
        joinSchemaPath(schemaPath, `oneOf/${index}`),
        dataPath,
      ),
    }));
    const passingBranches = branchResults.filter((result) => result.errors.length === 0);
    if (passingBranches.length !== 1) {
      if (passingBranches.length === 0) {
        const bestBranch = branchResults.reduce((best, current) =>
          current.errors.length < best.errors.length ? current : best,
        );
        errors.push(
          `${dataPath} must match exactly one schema in oneOf (${bestBranch.errors.join("; ") || "no matching branch"})`,
        );
      } else {
        errors.push(
          `${dataPath} must match exactly one schema in oneOf (matched ${passingBranches.length} branches)`,
        );
      }
      return errors;
    }
  }

  if (schema?.if) {
    const ifErrors = validateAgainstSchema(rootSchema, schema.if, value, joinSchemaPath(schemaPath, "if"), dataPath);
    if (ifErrors.length === 0 && schema.then) {
      errors.push(
        ...validateAgainstSchema(rootSchema, schema.then, value, joinSchemaPath(schemaPath, "then"), dataPath),
      );
    }
    if (ifErrors.length > 0 && schema.else) {
      errors.push(
        ...validateAgainstSchema(rootSchema, schema.else, value, joinSchemaPath(schemaPath, "else"), dataPath),
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(schema ?? {}, "const") && value !== schema.const) {
    errors.push(`${dataPath} must equal const ${formatValue(schema.const)} (got ${formatValue(value)})`);
    return errors;
  }

  if (Array.isArray(schema?.enum) && !schema.enum.includes(value)) {
    errors.push(
      `${dataPath} must be one of ${schema.enum.map((item) => formatValue(item)).join(", ")} (got ${formatValue(value)})`,
    );
    return errors;
  }

  if (schema?.type === "object" || (hasObjectKeywords(schema) && isPlainObject(value))) {
    if (!isPlainObject(value)) {
      errors.push(`${dataPath} must be an object`);
      return errors;
    }

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${dataPath} is missing required property ${key}`);
      }
    }

    const propertyKeys = Object.keys(schema.properties ?? {});
    const allowedKeys = new Set(propertyKeys);
    const additionalPropertiesSchema =
      isPlainObject(schema.additionalProperties) || schema.additionalProperties?.$ref
        ? schema.additionalProperties
        : null;
    for (const key of Object.keys(value)) {
      if (allowedKeys.has(key)) {
        continue;
      }
      if (schema.additionalProperties === false) {
        errors.push(`${dataPath} has unknown property ${key}`);
        continue;
      }
      if (additionalPropertiesSchema) {
        errors.push(
          ...validateAgainstSchema(
            rootSchema,
            additionalPropertiesSchema,
            value[key],
            joinSchemaPath(schemaPath, "additionalProperties"),
            joinDataPath(dataPath, key),
          ),
        );
      }
    }

    if (typeof schema.minProperties === "number" && Object.keys(value).length < schema.minProperties) {
      errors.push(`${dataPath} must contain at least ${schema.minProperties} propert${schema.minProperties === 1 ? "y" : "ies"}`);
    }

    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(
          ...validateAgainstSchema(
            rootSchema,
            propertySchema,
            value[key],
            joinSchemaPath(schemaPath, `properties/${key}`),
            joinDataPath(dataPath, key),
          ),
        );
      }
    }

    return errors;
  }

  if (schema?.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${dataPath} must be an array`);
      return errors;
    }

    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${dataPath} must contain at least ${schema.minItems} item(s)`);
    }

    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push(`${dataPath} must not contain duplicate items`);
          break;
        }
        seen.add(key);
      }
    }

    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(
          ...validateAgainstSchema(
            rootSchema,
            schema.items,
            item,
            joinSchemaPath(schemaPath, "items"),
            `${dataPath}[${index}]`,
          ),
        );
      });
    }

    return errors;
  }

  if (schema?.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${dataPath} must be a string`);
      return errors;
    }

    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${dataPath} must have length >= ${schema.minLength}`);
    }

    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push(`${dataPath} must have length <= ${schema.maxLength}`);
    }

    if (typeof schema.pattern === "string" && !(new RegExp(schema.pattern).test(value))) {
      errors.push(`${dataPath} must match pattern ${schema.pattern}`);
    }

    return errors;
  }

  if (schema?.type === "integer") {
    if (!Number.isInteger(value)) {
      errors.push(`${dataPath} must be an integer`);
      return errors;
    }

    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${dataPath} must be >= ${schema.minimum}`);
    }

    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${dataPath} must be <= ${schema.maximum}`);
    }

    return errors;
  }

  if (schema?.type === "number") {
    if (typeof value !== "number") {
      errors.push(`${dataPath} must be a number`);
      return errors;
    }
    return errors;
  }

  if (schema?.type === "boolean") {
    if (typeof value !== "boolean") {
      errors.push(`${dataPath} must be a boolean`);
    }
    return errors;
  }

  if (schema?.type === "null") {
    if (value !== null) {
      errors.push(`${dataPath} must be null`);
    }
    return errors;
  }

  return errors;
}

function loadArtifacts() {
  const jsonFiles = [
    ...listJsonFiles(path.join(extensionRoot, "schemas")),
    ...listJsonFiles(path.join(extensionRoot, "examples")),
    ...listJsonFiles(path.join(protocolRoot, "schemas")),
    ...listJsonFiles(path.join(protocolRoot, "examples")),
  ];

  const parsed = new Map();
  for (const filePath of jsonFiles) {
    parsed.set(filePath, readJson(filePath));
  }
  pass(`JSON parse succeeded for ${jsonFiles.length} schemas/examples/manifests`);

  return {
    parsed,
    extensionReadme: readText(extensionReadme),
    extensionArtifactsPlan: readText(extensionArtifactsPlan),
    extensionEnableStatePlan: readText(extensionEnableStatePlan),
    extensionManifestSchemaGatePlan: readText(extensionManifestSchemaGatePlan),
    extensionPlan: readText(extensionPhase1Plan),
    protocolPlan: readText(protocolScopedAuthPlan),
    extensionSchema: parsed.get(path.join(extensionRoot, "schemas/gettokens-extension-v0.schema.json")),
    extensionEnableStateSchema: parsed.get(
      path.join(extensionRoot, "schemas/gettokens-extension-enable-state-v0.schema.json"),
    ),
    extensionValidExample: parsed.get(
      path.join(extensionRoot, "examples/provider-metadata-model-catalog.valid.json"),
    ),
    extensionInvalidExample: parsed.get(
      path.join(extensionRoot, "examples/js-hook-unknown-capability.invalid.json"),
    ),
    extensionManifestInvalidExamples: [
      path.join(extensionRoot, "examples/js-hook-unknown-capability.invalid.json"),
      path.join(extensionRoot, "examples/provider-metadata-model-catalog.invalid-forbidden-permission.json"),
      path.join(extensionRoot, "examples/provider-metadata-model-catalog.invalid-missing-required.json"),
      path.join(extensionRoot, "examples/provider-metadata-model-catalog.invalid-unknown-top-level-field.json"),
      path.join(extensionRoot, "examples/provider-metadata-model-catalog.invalid-source-type.json"),
      path.join(
        extensionRoot,
        "examples/provider-metadata-model-catalog.invalid-capability-source-missing-required.json",
      ),
      path.join(
        extensionRoot,
        "examples/provider-metadata-model-catalog.invalid-declared-endpoint-missing-endpoint.json",
      ),
      path.join(
        extensionRoot,
        "examples/provider-metadata-model-catalog.invalid-static-json-missing-path.json",
      ),
    ].map((filePath) => ({
      filePath,
      artifact: parsed.get(filePath),
    })),
    extensionEnableStateExample: parsed.get(
      path.join(extensionRoot, "examples/enable-state-v0.valid.json"),
    ),
    extensionEnableStateInvalidExamples: [
      path.join(extensionRoot, "examples/enable-state-v0.invalid-enum.json"),
      path.join(extensionRoot, "examples/enable-state-v0.invalid-action-availability.json"),
      path.join(extensionRoot, "examples/enable-state-v0.invalid-missing-required.json"),
    ].map((filePath) => ({
      filePath,
      artifact: parsed.get(filePath),
    })),
    bridgeSchema: parsed.get(path.join(protocolRoot, "schemas/bridge-surface-v1.schema.json")),
    canonicalOperations: parsed.get(path.join(protocolRoot, "schemas/canonical-operations-v01.json")),
    mcpAdapterMapping: parsed.get(path.join(protocolRoot, "schemas/mcp-adapter-mapping-v01.json")),
    missingScopeExample: parsed.get(
      path.join(protocolRoot, "examples/rejected-missing-scope-response.json"),
    ),
    protocolRound14Plan: readText(protocolRound14Plan),
  };
}

function checkExtensionPlan(plan) {
  assertCheck(
    plan.includes("provider-metadata") &&
      plan.includes("model-catalog-source") &&
      plan.includes("account-importer") &&
      plan.includes("quota-probe"),
    "extension phase1 plan names the four v0 capabilities",
    "Phase 1 plan must keep the v0 capability whitelist visible.",
  );
  assertCheck(
    plan.includes("com.example.openai-metadata") &&
      plan.includes("provider-metadata") &&
      plan.includes("model-catalog-source"),
    "extension phase1 plan anchors the valid example identity and capabilities",
    "Valid example should remain tied to the read-only registry scenario.",
  );
  assertCheck(
    plan.includes("runtime.request.hook") && plan.includes("unknown-capability"),
    "extension phase1 plan anchors invalid JS hook / unknown capability evidence",
    "Invalid example evidence should remain explicit for later diagnostics.",
  );
}

function checkEnableStateDocs({
  extensionReadme,
  extensionArtifactsPlan,
  extensionEnableStatePlan,
  extensionManifestSchemaGatePlan,
}) {
  const expectedTokens = [...expectedEnableStates, ...expectedEnableActionAvailability];
  const docTargets = [
    { name: "extension README", text: extensionReadme },
    { name: "extension artifacts plan", text: extensionArtifactsPlan },
    { name: "round12 enable-state plan", text: extensionEnableStatePlan },
  ];

  for (const target of docTargets) {
    assertCheck(
      expectedTokens.every((token) => target.text.includes(target.name === "extension README" && token === "read-only" ? "read-only | disabled" : token)),
      `${target.name} keeps enable-state vocabulary visible`,
      `Missing one of: ${expectedTokens.filter((token) => !target.text.includes(token)).join(", ")}`,
    );
  }

  assertCheck(
    extensionReadme.includes("artifact gate") &&
      extensionReadme.includes("README、round12 plan 与 artifact 枚举一致"),
    "extension README documents enable-state artifact gate ownership",
    "README should state that enable-state vocabulary is enforced across artifact, README, and plan.",
  );
  assertCheck(
    extensionArtifactsPlan.includes("gettokens-extension-enable-state-v0.schema.json") &&
      extensionArtifactsPlan.includes("examples/enable-state-v0.valid.json") &&
      extensionArtifactsPlan.includes("examples/enable-state-v0.invalid-"),
    "extension artifacts plan lists enable-state schema and example",
    "Artifacts plan must list the dedicated enable-state valid and invalid artifacts.",
  );
  assertCheck(
    extensionEnableStatePlan.includes("check-omniroute-contract-artifacts.mjs") &&
      extensionEnableStatePlan.includes("Artifact Gate") &&
      extensionEnableStatePlan.includes("invalid fixture"),
    "round12 enable-state plan routes acceptance through artifact validator",
    "Round12 plan must include artifact gate and invalid fixture acceptance.",
  );
  assertCheck(
    extensionManifestSchemaGatePlan.includes("check-omniroute-contract-artifacts.mjs") &&
      extensionManifestSchemaGatePlan.includes("Artifact Gate") &&
      extensionManifestSchemaGatePlan.includes("unknown capability") &&
      extensionManifestSchemaGatePlan.includes("forbidden permission") &&
      extensionManifestSchemaGatePlan.includes("missing required field") &&
      extensionManifestSchemaGatePlan.includes("unknown top-level field") &&
      extensionManifestSchemaGatePlan.includes("invalid manifest source type") &&
      extensionManifestSchemaGatePlan.includes("capability missing required source field"),
    "round15 manifest schema gate plan routes acceptance through artifact validator",
    "Round15 plan must keep manifest schema gate coverage explicit.",
  );
}

function checkExtensionArtifacts({
  extensionSchema,
  extensionValidExample,
  extensionInvalidExample,
  extensionManifestInvalidExamples,
}) {
  const capabilityEnum = getArray(
    extensionSchema?.$defs?.capabilityKind?.enum,
    "extension schema $defs.capabilityKind.enum",
  );
  const permissionEnum = getArray(
    extensionSchema?.$defs?.permission?.enum,
    "extension schema $defs.permission.enum",
  );
  const validCapabilityKinds = extensionValidExample.capabilities.map((capability) => capability.kind);
  const invalidCapabilityKinds = extensionInvalidExample.capabilities.map((capability) => capability.kind);
  const invalidPermissions = extensionInvalidExample.permissions.filter(
    (permission) => !permissionEnum.includes(permission),
  );

  assertCheck(
    includesAll(capabilityEnum, expectedExtensionCapabilities),
    "extension schema capability enum contains all four v0 kinds",
    `Missing one of: ${expectedExtensionCapabilities.join(", ")}`,
  );
  assertCheck(
    extensionValidExample.id === "com.example.openai-metadata",
    "extension valid example id matches Phase 1 scenario",
    `Expected com.example.openai-metadata, got ${extensionValidExample.id}`,
  );
  assertCheck(
    includesAll(validCapabilityKinds, ["provider-metadata", "model-catalog-source"]),
    "extension valid example declares provider metadata and model catalog capabilities",
    `Got capability kinds: ${validCapabilityKinds.join(", ")}`,
  );
  assertCheck(
    includesAll(extensionValidExample.permissions, [
      "provider.metadata.read",
      "model.catalog.read",
      "network.fetch.declared-endpoints",
    ]),
    "extension valid example declares required read permissions",
    `Got permissions: ${extensionValidExample.permissions.join(", ")}`,
  );
  assertCheck(
    invalidCapabilityKinds.includes("js-hook") &&
      invalidCapabilityKinds.includes("provider-routing-policy") &&
      invalidCapabilityKinds.every((kind) => !capabilityEnum.includes(kind)),
    "extension invalid example contains unknown/forbidden capability evidence",
    `Got invalid capability kinds: ${invalidCapabilityKinds.join(", ")}`,
  );
  assertCheck(
    invalidPermissions.includes("runtime.request.hook"),
    "extension invalid example contains forbidden runtime hook permission evidence",
    `Invalid permissions found: ${invalidPermissions.join(", ") || "(none)"}`,
  );

  const validManifestErrors = validateAgainstSchema(
    extensionSchema,
    extensionSchema,
    extensionValidExample,
  );
  assertCheck(
    validManifestErrors.length === 0,
    "extension valid example passes local schema validation",
    validManifestErrors.join("; "),
  );

  const invalidExpectations = [
    {
      fileName: "js-hook-unknown-capability.invalid.json",
      matches: [
        "$.permissions[0] must be one of",
        "$.capabilities[0] must match exactly one schema in oneOf",
      ],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-forbidden-permission.json",
      matches: ["$.permissions[1] must be one of"],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-missing-required.json",
      matches: ["$ is missing required property compatibility"],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-unknown-top-level-field.json",
      matches: ["$ has unknown property experimentalFlag"],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-source-type.json",
      matches: ['$.source.type must be one of "local", "bundled"'],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-capability-source-missing-required.json",
      matches: [
        "$.capabilities[1] must match exactly one schema in oneOf",
        "$.capabilities[1] is missing required property source",
      ],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-declared-endpoint-missing-endpoint.json",
      matches: [
        "$.capabilities[1] must match exactly one schema in oneOf",
        "$.capabilities[1].source is missing required property endpoint",
      ],
    },
    {
      fileName: "provider-metadata-model-catalog.invalid-static-json-missing-path.json",
      matches: [
        "$.capabilities[1] must match exactly one schema in oneOf",
        "$.capabilities[1].source is missing required property path",
      ],
    },
  ];

  for (const expectation of invalidExpectations) {
    const invalidArtifact = extensionManifestInvalidExamples.find(
      (item) => path.basename(item.filePath) === expectation.fileName,
    );
    const invalidErrors = validateAgainstSchema(
      extensionSchema,
      extensionSchema,
      invalidArtifact?.artifact,
    );
    assertCheck(
      expectation.matches.every((match) => invalidErrors.some((error) => error.includes(match))),
      `${expectation.fileName} is rejected by extension manifest schema validation`,
      invalidErrors.join("; ") || "schema validation unexpectedly passed",
    );
  }
}

function checkProtocolRound14Plan(protocolRound14Plan) {
  assertCheck(
    protocolRound14Plan.includes("mapping fixture") &&
      protocolRound14Plan.includes("tool / resource"),
    "protocol round14 plan keeps stdio allowlist boundary visible",
    "Round14 plan must state that stdio only accepts mapping fixture tool/resource names.",
  );
  assertCheck(
    protocolRound14Plan.includes("Runtime.Authorize") &&
      protocolRound14Plan.includes("executor"),
    "protocol round14 plan keeps authorize-before-executor contract visible",
    "Round14 plan must preserve the Runtime.Authorize -> executor order.",
  );
  assertCheck(
    protocolRound14Plan.includes("credential-bearing input") &&
      protocolRound14Plan.includes("raw token") &&
      protocolRound14Plan.includes("cookie"),
    "protocol round14 plan keeps redaction and credential-bearing rejection visible",
    "Round14 plan must explicitly mention credential-bearing input rejection and secret redaction.",
  );
  assertCheck(
    protocolRound14Plan.includes("check-omniroute-contract-artifacts.mjs"),
    "protocol round14 plan routes acceptance through artifact validator",
    "Round14 plan must include the artifact validator in acceptance steps.",
  );
}

function checkEnableStateArtifacts({
  extensionEnableStateSchema,
  extensionEnableStateExample,
  extensionEnableStateInvalidExamples,
}) {
  const schemaEnableStates = getArray(
    extensionEnableStateSchema?.$defs?.enableState?.enum,
    "enable-state schema $defs.enableState.enum",
  );
  const schemaActionAvailability = getArray(
    extensionEnableStateSchema?.$defs?.actionAvailability?.enum,
    "enable-state schema $defs.actionAvailability.enum",
  );
  const exampleEnableStates = getArray(
    extensionEnableStateExample?.enableStates,
    "enable-state example enableStates",
  );
  const exampleActionAvailability = getArray(
    extensionEnableStateExample?.actionAvailability,
    "enable-state example actionAvailability",
  );
  const cases = getArray(extensionEnableStateExample?.cases, "enable-state example cases");
  const caseEnableStates = cases.map((item) => item.enableState);
  const caseActionAvailability = cases.map((item) => item.actionAvailability);
  const casesMissingReasons = cases.filter((item) => !Array.isArray(item.reasons) || item.reasons.length === 0);
  const reasonsMissingFields = cases.filter((item) =>
    item.reasons.some(
      (reason) =>
        typeof reason?.code !== "string" ||
        typeof reason?.label !== "string" ||
        typeof reason?.message !== "string",
    ),
  );

  assertCheck(
    extensionEnableStateSchema?.properties?.artifactVersion?.const ===
      "gettokens.extension.enable-state.v0",
    "enable-state schema declares dedicated artifact identity",
    `Got artifactVersion const=${extensionEnableStateSchema?.properties?.artifactVersion?.const}`,
  );
  assertCheck(
    includesAll(schemaEnableStates, expectedEnableStates),
    "enable-state schema enum contains all five derived states",
    `Missing states: ${expectedEnableStates.filter((item) => !schemaEnableStates.includes(item)).join(", ")}`,
  );
  assertCheck(
    includesAll(schemaActionAvailability, expectedEnableActionAvailability),
    "enable-state schema enum contains read-only and disabled action availability",
    `Missing action availability: ${expectedEnableActionAvailability
      .filter((item) => !schemaActionAvailability.includes(item))
      .join(", ")}`,
  );
  assertCheck(
    extensionEnableStateExample?.artifactVersion === "gettokens.extension.enable-state.v0" &&
      extensionEnableStateExample?.readOnlySlice === true,
    "enable-state example declares read-only artifact identity",
    `Got artifactVersion=${extensionEnableStateExample?.artifactVersion}, readOnlySlice=${extensionEnableStateExample?.readOnlySlice}`,
  );
  assertCheck(
    includesAll(exampleEnableStates, expectedEnableStates) &&
      includesAll(caseEnableStates, expectedEnableStates),
    "enable-state example covers every derived state in declarations and cases",
    `Missing declared states=${expectedEnableStates
      .filter((item) => !exampleEnableStates.includes(item))
      .join(", ") || "(none)"}, missing case states=${expectedEnableStates
      .filter((item) => !caseEnableStates.includes(item))
      .join(", ") || "(none)"}`,
  );
  assertCheck(
    includesAll(exampleActionAvailability, expectedEnableActionAvailability) &&
      includesAll(caseActionAvailability, expectedEnableActionAvailability),
    "enable-state example covers both action availability outcomes",
    `Missing declared action availability=${expectedEnableActionAvailability
      .filter((item) => !exampleActionAvailability.includes(item))
      .join(", ") || "(none)"}, missing case action availability=${expectedEnableActionAvailability
      .filter((item) => !caseActionAvailability.includes(item))
      .join(", ") || "(none)"}`,
  );
  assertCheck(
    casesMissingReasons.length === 0 && reasonsMissingFields.length === 0,
    "enable-state example reasons always include code, label, and message",
    `Cases missing reasons=${casesMissingReasons.map((item) => item.id).join(", ") || "(none)"}, malformed reasons=${reasonsMissingFields.map((item) => item.id).join(", ") || "(none)"}`,
  );

  const validErrors = validateAgainstSchema(
    extensionEnableStateSchema,
    extensionEnableStateSchema,
    extensionEnableStateExample,
  );
  assertCheck(
    validErrors.length === 0,
    "enable-state valid example passes local schema validation",
    validErrors.join("; "),
  );

  const invalidExpectations = [
    {
      fileName: "enable-state-v0.invalid-enum.json",
      match: "$.cases[0].enableState must be one of",
    },
    {
      fileName: "enable-state-v0.invalid-action-availability.json",
      match: "$.cases[0].actionAvailability must be one of",
    },
    {
      fileName: "enable-state-v0.invalid-missing-required.json",
      match: "$.cases[0] is missing required property reasons",
    },
  ];

  for (const expectation of invalidExpectations) {
    const invalidArtifact = extensionEnableStateInvalidExamples.find(
      (item) => path.basename(item.filePath) === expectation.fileName,
    );
    const invalidErrors = validateAgainstSchema(
      extensionEnableStateSchema,
      extensionEnableStateSchema,
      invalidArtifact?.artifact,
    );
    assertCheck(
      invalidErrors.some((error) => error.includes(expectation.match)),
      `${expectation.fileName} is rejected by local schema validation`,
      invalidErrors.join("; ") || "schema validation unexpectedly passed",
    );
  }
}

function checkProtocolPlan(plan) {
  assertCheck(
    expectedProtocolScopes.every((scope) => plan.includes(scope)),
    "protocol scoped auth plan lists expected scope catalog",
    "Scope catalog in plan must stay aligned with manifest checks.",
  );
  assertCheck(
    plan.includes("default_scope") &&
      plan.includes("authority.owner") &&
      plan.includes("sidecar") &&
      plan.includes("sidecar_invoked=false"),
    "protocol scoped auth plan anchors default scope, sidecar authority, and missing-scope rejection",
    "Plan should keep runtime authority and auth rejection semantics explicit.",
  );
}

function checkProtocolArtifacts({ bridgeSchema, canonicalOperations, missingScopeExample }) {
  const schemaOperations = getArray(
    bridgeSchema?.$defs?.operation?.enum,
    "bridge schema $defs.operation.enum",
  );
  const operations = getArray(canonicalOperations.operations, "canonical operations");
  const operationIds = operations.map((operation) => operation.id);
  const missingDefaultScope = operations.filter((operation) => !operation.default_scope);
  const nonSidecarAuthority = operations.filter((operation) => operation.authority?.owner !== "sidecar");
  const safeActionsWithoutIdempotency = operations.filter(
    (operation) => operation.type === "safe_action" && operation.requires_idempotency_key !== true,
  );

  assertCheck(
    operationIds.every((operationId) => schemaOperations.includes(operationId)),
    "protocol manifest operations are present in bridge schema operation enum",
    `Manifest-only operations: ${operationIds.filter((id) => !schemaOperations.includes(id)).join(", ")}`,
  );
  assertCheck(
    schemaOperations.every((operationId) => operationIds.includes(operationId)),
    "bridge schema operation enum is covered by protocol manifest",
    `Schema-only operations: ${schemaOperations.filter((id) => !operationIds.includes(id)).join(", ")}`,
  );
  assertCheck(
    missingDefaultScope.length === 0,
    "protocol manifest operations all define default_scope",
    `Missing default_scope: ${missingDefaultScope.map((operation) => operation.id).join(", ")}`,
  );
  assertCheck(
    operations.every((operation) => expectedProtocolScopes.includes(operation.default_scope)),
    "protocol manifest default_scope values belong to scoped auth catalog",
    `Unexpected scopes: ${operations
      .map((operation) => operation.default_scope)
      .filter((scope) => !expectedProtocolScopes.includes(scope))
      .join(", ")}`,
  );
  assertCheck(
    nonSidecarAuthority.length === 0,
    "protocol manifest operations all keep authority owner as sidecar",
    `Non-sidecar authority: ${nonSidecarAuthority.map((operation) => operation.id).join(", ")}`,
  );
  assertCheck(
    safeActionsWithoutIdempotency.length === 0,
    "protocol safe actions require idempotency keys",
    `Missing idempotency: ${safeActionsWithoutIdempotency.map((operation) => operation.id).join(", ")}`,
  );
  assertCheck(
    includesAll(canonicalOperations.forbidden_bridge_state ?? [], requiredForbiddenBridgeState),
    "protocol manifest forbidden bridge state keeps hot-path truth out of bridge",
    `Missing forbidden state: ${requiredForbiddenBridgeState
      .filter((state) => !(canonicalOperations.forbidden_bridge_state ?? []).includes(state))
      .join(", ")}`,
  );
  assertCheck(
    missingScopeExample.status === "rejected" &&
      missingScopeExample.error?.code === "missing_scope" &&
      missingScopeExample.error?.sidecar_invoked === false,
    "protocol missing-scope example rejects before sidecar invocation",
    `Got status=${missingScopeExample.status}, code=${missingScopeExample.error?.code}, sidecar_invoked=${missingScopeExample.error?.sidecar_invoked}`,
  );
}

function checkProtocolMCPAdapterMapping({ bridgeSchema, canonicalOperations, mcpAdapterMapping }) {
  const operations = getArray(canonicalOperations.operations, "canonical operations");
  const operationIds = operations.map((operation) => operation.id);
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const schemaDefs = bridgeSchema?.$defs ?? {};
  const tools = getArray(mcpAdapterMapping?.tools, "MCP adapter mapping tools");
  const resources = getArray(mcpAdapterMapping?.resources, "MCP adapter mapping resources");
  const toolNames = tools.map((tool) => tool.name);
  const mappedOperations = tools.map((tool) => tool.canonical_operation);
  const duplicateToolNames = toolNames.filter((name, index) => toolNames.indexOf(name) !== index);
  const duplicateOperations = mappedOperations.filter(
    (operation, index) => mappedOperations.indexOf(operation) !== index,
  );
  const missingOperations = operationIds.filter((operationId) => !mappedOperations.includes(operationId));
  const extraOperations = mappedOperations.filter((operationId) => !operationById.has(operationId));
  const scopeMismatches = tools.filter((tool) => {
    const operation = operationById.get(tool.canonical_operation);
    return operation && tool.required_scope !== operation.default_scope;
  });
  const typeMismatches = tools.filter((tool) => {
    const operation = operationById.get(tool.canonical_operation);
    return operation && tool.type !== operation.type;
  });
  const queryTargetMismatches = tools.filter((tool) => tool.query_target !== "canonical.query");
  const responseEnvelopeMismatches = tools.filter(
    (tool) => tool.response_envelope !== "bridge.surface.v1.responseEnvelope",
  );
  const adapterTruthTools = tools.filter((tool) => (tool.adapter_only_truth_fields ?? []).length > 0);
  const safeActionsWithoutIdempotency = tools.filter((tool) => {
    const operation = operationById.get(tool.canonical_operation);
    return operation?.type === "safe_action" && tool.requires_idempotency_key !== true;
  });
  const safeActionsWithCompletionSemantics = tools.filter((tool) => {
    const operation = operationById.get(tool.canonical_operation);
    return operation?.type === "safe_action" && tool.safe_action_result !== "operation_ref_only";
  });
  const readToolsWithIdempotency = tools.filter((tool) => {
    const operation = operationById.get(tool.canonical_operation);
    return operation?.type === "read" && tool.requires_idempotency_key === true;
  });
  const invalidQueryRefs = tools.filter((tool) => {
    const match = String(tool.query_schema_ref ?? "").match(/^schemas\/bridge-surface-v1\.schema\.json#\/\$defs\/(.+)$/);
    return !match || !schemaDefs[match[1]];
  });
  const allowedResourceKinds = new Set(["manifest", "schema", "scope_list"]);
  const resourceKinds = resources.map((resource) => resource.kind);
  const invalidResourceKinds = resources.filter((resource) => !allowedResourceKinds.has(resource.kind));
  const forbiddenResourcePattern =
    /(token[_-]?hash|auth[_-]?subject[_-]?hash|audit[_-]?secret|raw[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key[_-]?plaintext|cookie|authorization[_-]?header)/i;
  const resourcesWithSecrets = resources.filter((resource) =>
    [resource.name, resource.uri, resource.kind, resource.source, ...(resource.exposes ?? [])].some((value) =>
      forbiddenResourcePattern.test(String(value)),
    ),
  );

  assertCheck(
    mcpAdapterMapping.version === "gettokens.bridge.mcp.adapter.mapping.v1" &&
      mcpAdapterMapping.transport === "mcp",
    "MCP adapter mapping declares v1 MCP fixture identity",
    `Got version=${mcpAdapterMapping.version}, transport=${mcpAdapterMapping.transport}`,
  );
  assertCheck(
    duplicateToolNames.length === 0 && duplicateOperations.length === 0,
    "MCP adapter tool names map one-to-one to canonical operations",
    `Duplicate tools=${duplicateToolNames.join(", ") || "(none)"}, duplicate operations=${duplicateOperations.join(", ") || "(none)"}`,
  );
  assertCheck(
    missingOperations.length === 0 && extraOperations.length === 0,
    "MCP adapter mapping covers exactly the canonical operations",
    `Missing=${missingOperations.join(", ") || "(none)"}, extra=${extraOperations.join(", ") || "(none)"}`,
  );
  assertCheck(
    scopeMismatches.length === 0 && typeMismatches.length === 0,
    "MCP adapter tool scopes and types match canonical operations",
    `Scope mismatches=${scopeMismatches.map((tool) => tool.name).join(", ") || "(none)"}, type mismatches=${typeMismatches.map((tool) => tool.name).join(", ") || "(none)"}`,
  );
  assertCheck(
    queryTargetMismatches.length === 0 &&
      responseEnvelopeMismatches.length === 0 &&
      invalidQueryRefs.length === 0,
    "MCP adapter tools reuse canonical query schemas and response envelope",
    `Query target mismatches=${queryTargetMismatches.map((tool) => tool.name).join(", ") || "(none)"}, response mismatches=${responseEnvelopeMismatches.map((tool) => tool.name).join(", ") || "(none)"}, invalid query refs=${invalidQueryRefs.map((tool) => tool.name).join(", ") || "(none)"}`,
  );
  assertCheck(
    adapterTruthTools.length === 0,
    "MCP adapter tools do not declare adapter-only truth fields",
    `Adapter-only truth tools=${adapterTruthTools.map((tool) => tool.name).join(", ") || "(none)"}`,
  );
  assertCheck(
    safeActionsWithoutIdempotency.length === 0 &&
      safeActionsWithCompletionSemantics.length === 0 &&
      readToolsWithIdempotency.length === 0,
    "MCP adapter safe actions require idempotency and expose operation refs only",
    `Missing idempotency=${safeActionsWithoutIdempotency.map((tool) => tool.name).join(", ") || "(none)"}, wrong semantics=${safeActionsWithCompletionSemantics.map((tool) => tool.name).join(", ") || "(none)"}, read idempotency=${readToolsWithIdempotency.map((tool) => tool.name).join(", ") || "(none)"}`,
  );
  assertCheck(
    invalidResourceKinds.length === 0 &&
      includesAll(resourceKinds, ["manifest", "schema", "scope_list"]) &&
      resourcesWithSecrets.length === 0,
    "MCP adapter resources expose only manifest, schema, and scope list without secret material",
    `Invalid kinds=${invalidResourceKinds.map((resource) => resource.kind).join(", ") || "(none)"}, secret resources=${resourcesWithSecrets.map((resource) => resource.name).join(", ") || "(none)"}`,
  );
}

try {
  const artifacts = loadArtifacts();
  checkExtensionPlan(artifacts.extensionPlan);
  checkEnableStateDocs(artifacts);
  checkExtensionArtifacts(artifacts);
  checkEnableStateArtifacts(artifacts);
  checkProtocolPlan(artifacts.protocolPlan);
  checkProtocolArtifacts(artifacts);
  checkProtocolMCPAdapterMapping(artifacts);
  checkProtocolRound14Plan(artifacts.protocolRound14Plan);
} catch (error) {
  fail("validator crashed", error.message);
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? "ok" : "not ok";
  console.log(`${prefix} - ${check.name}`);
  if (!check.ok && check.details) {
    console.log(`  ${check.details}`);
  }
}

if (failed.length > 0) {
  console.error(`OmniRoute contract artifact check failed: ${failed.length} failure(s).`);
  process.exit(1);
}

console.log(`OmniRoute contract artifact check passed: ${checks.length} check(s).`);
