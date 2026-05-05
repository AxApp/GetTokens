export namespace main {

	export class AccountRecord {
	    id: string;
	    provider: string;
	    credentialSource: string;
	    displayName: string;
	    status: string;
	    priority?: number;
	    disabled?: boolean;
	    email?: string;
	    planType?: string;
	    name?: string;
	    apiKey?: string;
	    keyFingerprint?: string;
	    keySuffix?: string;
	    baseUrl?: string;
	    prefix?: string;
	    authIndex?: any;
	    quotaKey?: string;
	    quotaCurl?: string;
	    quotaEnabled?: boolean;
	    localOnly?: boolean;

	    static createFrom(source: any = {}) {
	        return new AccountRecord(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.provider = source["provider"];
	        this.credentialSource = source["credentialSource"];
	        this.displayName = source["displayName"];
	        this.status = source["status"];
	        this.priority = source["priority"];
	        this.disabled = source["disabled"];
	        this.email = source["email"];
	        this.planType = source["planType"];
	        this.name = source["name"];
	        this.apiKey = source["apiKey"];
	        this.keyFingerprint = source["keyFingerprint"];
	        this.keySuffix = source["keySuffix"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.authIndex = source["authIndex"];
	        this.quotaKey = source["quotaKey"];
	        this.quotaCurl = source["quotaCurl"];
	        this.quotaEnabled = source["quotaEnabled"];
	        this.localOnly = source["localOnly"];
	    }
	}
	export class AuthFileItem {
	    name: string;
	    type?: string;
	    provider?: string;
	    email?: string;
	    planType?: string;
	    size?: number;
	    authIndex?: any;
	    runtimeOnly?: boolean;
	    disabled?: boolean;
	    unavailable?: boolean;
	    status?: string;
	    statusMessage?: string;
	    lastRefresh?: any;
	    modified?: number;

	    static createFrom(source: any = {}) {
	        return new AuthFileItem(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.provider = source["provider"];
	        this.email = source["email"];
	        this.planType = source["planType"];
	        this.size = source["size"];
	        this.authIndex = source["authIndex"];
	        this.runtimeOnly = source["runtimeOnly"];
	        this.disabled = source["disabled"];
	        this.unavailable = source["unavailable"];
	        this.status = source["status"];
	        this.statusMessage = source["statusMessage"];
	        this.lastRefresh = source["lastRefresh"];
	        this.modified = source["modified"];
	    }
	}
	export class AuthFilesResponse {
	    files: AuthFileItem[];
	    total?: number;

	    static createFrom(source: any = {}) {
	        return new AuthFilesResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = this.convertValues(source["files"], AuthFileItem);
	        this.total = source["total"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ClaudeCodeLocalApplyResult {
	    claudeConfigDirPath: string;
	    settingsPath: string;
	    warnings?: string[];
	    conflicts?: string[];

	    static createFrom(source: any = {}) {
	        return new ClaudeCodeLocalApplyResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.claudeConfigDirPath = source["claudeConfigDirPath"];
	        this.settingsPath = source["settingsPath"];
	        this.warnings = source["warnings"];
	        this.conflicts = source["conflicts"];
	    }
	}
	export class CodexFeatureConfigChange {
	    key: string;
	    type: string;
	    previousEnabled?: boolean;
	    nextEnabled: boolean;

	    static createFrom(source: any = {}) {
	        return new CodexFeatureConfigChange(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.type = source["type"];
	        this.previousEnabled = source["previousEnabled"];
	        this.nextEnabled = source["nextEnabled"];
	    }
	}
	export class CodexFeatureConfigPreview {
	    configPath: string;
	    willCreate: boolean;
	    changes: CodexFeatureConfigChange[];
	    preview: string;
	    warnings: string[];

	    static createFrom(source: any = {}) {
	        return new CodexFeatureConfigPreview(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.willCreate = source["willCreate"];
	        this.changes = this.convertValues(source["changes"], CodexFeatureConfigChange);
	        this.preview = source["preview"];
	        this.warnings = source["warnings"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CodexFeatureDefinition {
	    key: string;
	    description?: string;
	    stage: string;
	    defaultEnabled: boolean;
	    canonicalKey?: string;
	    legacyAlias?: boolean;

	    static createFrom(source: any = {}) {
	        return new CodexFeatureDefinition(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.description = source["description"];
	        this.stage = source["stage"];
	        this.defaultEnabled = source["defaultEnabled"];
	        this.canonicalKey = source["canonicalKey"];
	        this.legacyAlias = source["legacyAlias"];
	    }
	}
	export class CodexFeatureConfigSnapshot {
	    codexHomePath: string;
	    configPath: string;
	    exists: boolean;
	    definitions: CodexFeatureDefinition[];
	    values: Record<string, boolean>;
	    unknownValues?: Record<string, boolean>;
	    raw: string;
	    warnings: string[];

	    static createFrom(source: any = {}) {
	        return new CodexFeatureConfigSnapshot(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codexHomePath = source["codexHomePath"];
	        this.configPath = source["configPath"];
	        this.exists = source["exists"];
	        this.definitions = this.convertValues(source["definitions"], CodexFeatureDefinition);
	        this.values = source["values"];
	        this.unknownValues = source["unknownValues"];
	        this.raw = source["raw"];
	        this.warnings = source["warnings"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class CodexQuotaWindow {
	    id: string;
	    label: string;
	    remainingPercent?: number;
	    resetLabel: string;
	    resetAtUnix?: number;

	    static createFrom(source: any = {}) {
	        return new CodexQuotaWindow(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.remainingPercent = source["remainingPercent"];
	        this.resetLabel = source["resetLabel"];
	        this.resetAtUnix = source["resetAtUnix"];
	    }
	}
	export class CodexQuotaResponse {
	    planType?: string;
	    windows: CodexQuotaWindow[];

	    static createFrom(source: any = {}) {
	        return new CodexQuotaResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.planType = source["planType"];
	        this.windows = this.convertValues(source["windows"], CodexQuotaWindow);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class CompleteCodexOAuthInput {
	    existingName: string;
	    previousNames: string[];

	    static createFrom(source: any = {}) {
	        return new CompleteCodexOAuthInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.existingName = source["existingName"];
	        this.previousNames = source["previousNames"];
	    }
	}
	export class CreateCodexAPIKeyInput {
	    apiKey: string;
	    label?: string;
	    baseUrl: string;
	    priority?: number;
	    prefix?: string;
	    proxyUrl?: string;
	    headers?: Record<string, string>;
	    excludedModels?: string[];
	    quotaCurl?: string;
	    quotaEnabled?: boolean;

	    static createFrom(source: any = {}) {
	        return new CreateCodexAPIKeyInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.label = source["label"];
	        this.baseUrl = source["baseUrl"];
	        this.priority = source["priority"];
	        this.prefix = source["prefix"];
	        this.proxyUrl = source["proxyUrl"];
	        this.headers = source["headers"];
	        this.excludedModels = source["excludedModels"];
	        this.quotaCurl = source["quotaCurl"];
	        this.quotaEnabled = source["quotaEnabled"];
	    }
	}
	export class CreateOpenAICompatibleProviderInput {
	    name: string;
	    baseUrl: string;
	    prefix?: string;
	    apiKey: string;

	    static createFrom(source: any = {}) {
	        return new CreateOpenAICompatibleProviderInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.apiKey = source["apiKey"];
	    }
	}
	export class DownloadFileResponse {
	    name: string;
	    contentBase64: string;

	    static createFrom(source: any = {}) {
	        return new DownloadFileResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.contentBase64 = source["contentBase64"];
	    }
	}
	export class FetchOpenAICompatibleProviderModelsInput {
	    baseUrl: string;
	    apiKey: string;
	    headers?: Record<string, string>;

	    static createFrom(source: any = {}) {
	        return new FetchOpenAICompatibleProviderModelsInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseUrl = source["baseUrl"];
	        this.apiKey = source["apiKey"];
	        this.headers = source["headers"];
	    }
	}
	export class OpenAICompatibleModel {
	    name: string;
	    alias?: string;
	    supportedReasoningEfforts?: string[];
	    defaultReasoningEffort?: string;

	    static createFrom(source: any = {}) {
	        return new OpenAICompatibleModel(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.alias = source["alias"];
	        this.supportedReasoningEfforts = source["supportedReasoningEfforts"];
	        this.defaultReasoningEffort = source["defaultReasoningEffort"];
	    }
	}
	export class FetchOpenAICompatibleProviderModelsResult {
	    models?: OpenAICompatibleModel[];
	    statusCode?: number;
	    message?: string;
	    responseBody?: string;

	    static createFrom(source: any = {}) {
	        return new FetchOpenAICompatibleProviderModelsResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	        this.statusCode = source["statusCode"];
	        this.message = source["message"];
	        this.responseBody = source["responseBody"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FetchProxySubscriptionInput {
	    url: string;
	    sourceLabel?: string;

	    static createFrom(source: any = {}) {
	        return new FetchProxySubscriptionInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.sourceLabel = source["sourceLabel"];
	    }
	}
	export class FetchProxySubscriptionResult {
	    url: string;
	    sourceLabel: string;
	    content: string;

	    static createFrom(source: any = {}) {
	        return new FetchProxySubscriptionResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.sourceLabel = source["sourceLabel"];
	        this.content = source["content"];
	    }
	}
	export class LocalCodexModelProviderView {
	    providerID: string;
	    providerName: string;

	    static createFrom(source: any = {}) {
	        return new LocalCodexModelProviderView(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.providerID = source["providerID"];
	        this.providerName = source["providerName"];
	    }
	}
	export class LocalProjectedUsageDetail {
	    timestamp: string;
	    provider: string;
	    sourceKind: string;
	    model?: string;
	    inputTokens: number;
	    cachedInputTokens: number;
	    outputTokens: number;
	    requestCount: number;

	    static createFrom(source: any = {}) {
	        return new LocalProjectedUsageDetail(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.provider = source["provider"];
	        this.sourceKind = source["sourceKind"];
	        this.model = source["model"];
	        this.inputTokens = source["inputTokens"];
	        this.cachedInputTokens = source["cachedInputTokens"];
	        this.outputTokens = source["outputTokens"];
	        this.requestCount = source["requestCount"];
	    }
	}
	export class LocalProjectedUsageResponse {
	    provider: string;
	    sourceKind: string;
	    scannedFiles: number;
	    cacheHitFiles?: number;
	    deltaAppendFiles?: number;
	    fullRebuildFiles?: number;
	    fileMissingFiles?: number;
	    details: LocalProjectedUsageDetail[];

	    static createFrom(source: any = {}) {
	        return new LocalProjectedUsageResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.sourceKind = source["sourceKind"];
	        this.scannedFiles = source["scannedFiles"];
	        this.cacheHitFiles = source["cacheHitFiles"];
	        this.deltaAppendFiles = source["deltaAppendFiles"];
	        this.fullRebuildFiles = source["fullRebuildFiles"];
	        this.fileMissingFiles = source["fileMissingFiles"];
	        this.details = this.convertValues(source["details"], LocalProjectedUsageDetail);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LocalProjectedUsageSettings {
	    refreshIntervalMinutes: number;

	    static createFrom(source: any = {}) {
	        return new LocalProjectedUsageSettings(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.refreshIntervalMinutes = source["refreshIntervalMinutes"];
	    }
	}
	export class OAuthStartResult {
	    url: string;
	    state?: string;

	    static createFrom(source: any = {}) {
	        return new OAuthStartResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.state = source["state"];
	    }
	}
	export class OAuthStatusResult {
	    status: string;
	    error?: string;

	    static createFrom(source: any = {}) {
	        return new OAuthStatusResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}

	export class OpenAICompatibleProvider {
	    name: string;
	    priority?: number;
	    disabled?: boolean;
	    baseUrl: string;
	    prefix?: string;
	    apiKey: string;
	    apiKeys?: string[];
	    models?: OpenAICompatibleModel[];
	    headers?: Record<string, string>;
	    keyCount?: number;
	    modelCount?: number;
	    hasHeaders?: boolean;

	    static createFrom(source: any = {}) {
	        return new OpenAICompatibleProvider(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.priority = source["priority"];
	        this.disabled = source["disabled"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.apiKey = source["apiKey"];
	        this.apiKeys = source["apiKeys"];
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	        this.headers = source["headers"];
	        this.keyCount = source["keyCount"];
	        this.modelCount = source["modelCount"];
	        this.hasHeaders = source["hasHeaders"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProbeProxyNodeInput {
	    proxyUrl: string;
	    targetUrl?: string;

	    static createFrom(source: any = {}) {
	        return new ProbeProxyNodeInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.proxyUrl = source["proxyUrl"];
	        this.targetUrl = source["targetUrl"];
	    }
	}
	export class ProbeProxyNodeResult {
	    proxyUrl: string;
	    targetUrl: string;
	    success: boolean;
	    statusCode?: number;
	    latencyMs: number;
	    checkedAt: string;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new ProbeProxyNodeResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.proxyUrl = source["proxyUrl"];
	        this.targetUrl = source["targetUrl"];
	        this.success = source["success"];
	        this.statusCode = source["statusCode"];
	        this.latencyMs = source["latencyMs"];
	        this.checkedAt = source["checkedAt"];
	        this.message = source["message"];
	    }
	}
	export class RelayLocalApplyResult {
	    codexHomePath: string;
	    authFilePath: string;
	    configPath: string;

	    static createFrom(source: any = {}) {
	        return new RelayLocalApplyResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codexHomePath = source["codexHomePath"];
	        this.authFilePath = source["authFilePath"];
	        this.configPath = source["configPath"];
	    }
	}
	export class RelayRoutingConfig {
	    strategy: string;
	    sessionAffinity: boolean;
	    sessionAffinityTTL: string;
	    requestRetry: number;
	    maxRetryCredentials: number;
	    maxRetryInterval: number;
	    switchProject: boolean;
	    switchPreviewModel: boolean;
	    antigravityCredits: boolean;

	    static createFrom(source: any = {}) {
	        return new RelayRoutingConfig(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.strategy = source["strategy"];
	        this.sessionAffinity = source["sessionAffinity"];
	        this.sessionAffinityTTL = source["sessionAffinityTTL"];
	        this.requestRetry = source["requestRetry"];
	        this.maxRetryCredentials = source["maxRetryCredentials"];
	        this.maxRetryInterval = source["maxRetryInterval"];
	        this.switchProject = source["switchProject"];
	        this.switchPreviewModel = source["switchPreviewModel"];
	        this.antigravityCredits = source["antigravityCredits"];
	    }
	}
	export class RelayServiceAPIKeyItem {
	    value: string;
	    createdAt?: string;
	    lastUsedAt?: string;

	    static createFrom(source: any = {}) {
	        return new RelayServiceAPIKeyItem(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.value = source["value"];
	        this.createdAt = source["createdAt"];
	        this.lastUsedAt = source["lastUsedAt"];
	    }
	}
	export class RelayServiceEndpoint {
	    id: string;
	    kind: string;
	    host: string;
	    baseUrl: string;

	    static createFrom(source: any = {}) {
	        return new RelayServiceEndpoint(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.host = source["host"];
	        this.baseUrl = source["baseUrl"];
	    }
	}
	export class RelayServiceConfig {
	    apiKeys: string[];
	    apiKeyItems: RelayServiceAPIKeyItem[];
	    endpoints: RelayServiceEndpoint[];

	    static createFrom(source: any = {}) {
	        return new RelayServiceConfig(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKeys = source["apiKeys"];
	        this.apiKeyItems = this.convertValues(source["apiKeyItems"], RelayServiceAPIKeyItem);
	        this.endpoints = this.convertValues(source["endpoints"], RelayServiceEndpoint);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class RelaySupportedModelsResult {
	    models: OpenAICompatibleModel[];

	    static createFrom(source: any = {}) {
	        return new RelaySupportedModelsResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SaveCodexFeatureConfigInput {
	    values: Record<string, boolean>;

	    static createFrom(source: any = {}) {
	        return new SaveCodexFeatureConfigInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.values = source["values"];
	    }
	}
	export class SessionManagementMessageRecord {
	    id: string;
	    role: string;
	    timeLabel: string;
	    timestamp?: string;
	    title: string;
	    summary: string;
	    content: string;
	    truncated?: boolean;

	    static createFrom(source: any = {}) {
	        return new SessionManagementMessageRecord(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.role = source["role"];
	        this.timeLabel = source["timeLabel"];
	        this.timestamp = source["timestamp"];
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.content = source["content"];
	        this.truncated = source["truncated"];
	    }
	}
	export class SessionManagementSessionRecord {
	    id: string;
	    sessionID: string;
	    projectID: string;
	    projectName: string;
	    title: string;
	    status: string;
	    archived: boolean;
	    messageCount: number;
	    roleSummary: string;
	    startedAt: string;
	    updatedAt: string;
	    fileLabel: string;
	    summary: string;
	    preview: string;
	    topic: string;
	    currentMessageLabel: string;
	    provider: string;
	    model?: string;

	    static createFrom(source: any = {}) {
	        return new SessionManagementSessionRecord(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionID = source["sessionID"];
	        this.projectID = source["projectID"];
	        this.projectName = source["projectName"];
	        this.title = source["title"];
	        this.status = source["status"];
	        this.archived = source["archived"];
	        this.messageCount = source["messageCount"];
	        this.roleSummary = source["roleSummary"];
	        this.startedAt = source["startedAt"];
	        this.updatedAt = source["updatedAt"];
	        this.fileLabel = source["fileLabel"];
	        this.summary = source["summary"];
	        this.preview = source["preview"];
	        this.topic = source["topic"];
	        this.currentMessageLabel = source["currentMessageLabel"];
	        this.provider = source["provider"];
	        this.model = source["model"];
	    }
	}
	export class SessionManagementProjectRecord {
	    id: string;
	    name: string;
	    providerCounts?: Record<string, number>;
	    sessionCount: number;
	    activeSessionCount: number;
	    archivedSessionCount: number;
	    lastActiveAt: string;
	    providerSummary: string;
	    sessions: SessionManagementSessionRecord[];

	    static createFrom(source: any = {}) {
	        return new SessionManagementProjectRecord(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.providerCounts = source["providerCounts"];
	        this.sessionCount = source["sessionCount"];
	        this.activeSessionCount = source["activeSessionCount"];
	        this.archivedSessionCount = source["archivedSessionCount"];
	        this.lastActiveAt = source["lastActiveAt"];
	        this.providerSummary = source["providerSummary"];
	        this.sessions = this.convertValues(source["sessions"], SessionManagementSessionRecord);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionManagementSessionDetail {
	    sessionID: string;
	    projectID: string;
	    projectName: string;
	    title: string;
	    status: string;
	    archived: boolean;
	    fileLabel: string;
	    messageCount: number;
	    masked: boolean;
	    currentMessageLabel: string;
	    roleSummary: string;
	    topic: string;
	    preview: string;
	    provider: string;
	    model?: string;
	    startedAt: string;
	    updatedAt: string;
	    messages: SessionManagementMessageRecord[];

	    static createFrom(source: any = {}) {
	        return new SessionManagementSessionDetail(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionID = source["sessionID"];
	        this.projectID = source["projectID"];
	        this.projectName = source["projectName"];
	        this.title = source["title"];
	        this.status = source["status"];
	        this.archived = source["archived"];
	        this.fileLabel = source["fileLabel"];
	        this.messageCount = source["messageCount"];
	        this.masked = source["masked"];
	        this.currentMessageLabel = source["currentMessageLabel"];
	        this.roleSummary = source["roleSummary"];
	        this.topic = source["topic"];
	        this.preview = source["preview"];
	        this.provider = source["provider"];
	        this.model = source["model"];
	        this.startedAt = source["startedAt"];
	        this.updatedAt = source["updatedAt"];
	        this.messages = this.convertValues(source["messages"], SessionManagementMessageRecord);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class SessionManagementSnapshot {
	    projectCount: number;
	    sessionCount: number;
	    activeSessionCount: number;
	    archivedSessionCount: number;
	    lastScanAt: string;
	    providerCounts: Record<string, number>;
	    projects: SessionManagementProjectRecord[];

	    static createFrom(source: any = {}) {
	        return new SessionManagementSnapshot(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectCount = source["projectCount"];
	        this.sessionCount = source["sessionCount"];
	        this.activeSessionCount = source["activeSessionCount"];
	        this.archivedSessionCount = source["archivedSessionCount"];
	        this.lastScanAt = source["lastScanAt"];
	        this.providerCounts = source["providerCounts"];
	        this.projects = this.convertValues(source["projects"], SessionManagementProjectRecord);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TestCodexAPIKeyQuotaCurlInput {
	    apiKey: string;
	    baseUrl: string;
	    prefix?: string;
	    quotaCurl: string;

	    static createFrom(source: any = {}) {
	        return new TestCodexAPIKeyQuotaCurlInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.quotaCurl = source["quotaCurl"];
	    }
	}
	export class UpdateAccountPriorityInput {
	    id: string;
	    priority?: number;

	    static createFrom(source: any = {}) {
	        return new UpdateAccountPriorityInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.priority = source["priority"];
	    }
	}
	export class UpdateCodexAPIKeyConfigInput {
	    id: string;
	    apiKey: string;
	    baseUrl: string;
	    prefix?: string;
	    quotaCurl?: string;
	    quotaEnabled?: boolean;

	    static createFrom(source: any = {}) {
	        return new UpdateCodexAPIKeyConfigInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.apiKey = source["apiKey"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.quotaCurl = source["quotaCurl"];
	        this.quotaEnabled = source["quotaEnabled"];
	    }
	}
	export class UpdateCodexAPIKeyLabelInput {
	    id: string;
	    label?: string;

	    static createFrom(source: any = {}) {
	        return new UpdateCodexAPIKeyLabelInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	    }
	}
	export class UpdateCodexAPIKeyPriorityInput {
	    id: string;
	    priority?: number;

	    static createFrom(source: any = {}) {
	        return new UpdateCodexAPIKeyPriorityInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.priority = source["priority"];
	    }
	}
	export class UpdateOpenAICompatibleProviderInput {
	    currentName: string;
	    name: string;
	    baseUrl: string;
	    prefix?: string;
	    apiKey: string;
	    apiKeys?: string[];
	    headers?: Record<string, string>;
	    models?: OpenAICompatibleModel[];

	    static createFrom(source: any = {}) {
	        return new UpdateOpenAICompatibleProviderInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentName = source["currentName"];
	        this.name = source["name"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.apiKey = source["apiKey"];
	        this.apiKeys = source["apiKeys"];
	        this.headers = source["headers"];
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateSessionProviderMapping {
	    sourceProvider: string;
	    targetProvider: string;

	    static createFrom(source: any = {}) {
	        return new UpdateSessionProviderMapping(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceProvider = source["sourceProvider"];
	        this.targetProvider = source["targetProvider"];
	    }
	}
	export class UpdateSessionProvidersInput {
	    projectID: string;
	    mappings: UpdateSessionProviderMapping[];

	    static createFrom(source: any = {}) {
	        return new UpdateSessionProvidersInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectID = source["projectID"];
	        this.mappings = this.convertValues(source["mappings"], UpdateSessionProviderMapping);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UploadFilePayload {
	    name: string;
	    contentBase64: string;

	    static createFrom(source: any = {}) {
	        return new UploadFilePayload(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.contentBase64 = source["contentBase64"];
	    }
	}
	export class UsageStatisticsResponse {
	    usage: Record<string, any>;
	    failedRequests?: number;

	    static createFrom(source: any = {}) {
	        return new UsageStatisticsResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.usage = source["usage"];
	        this.failedRequests = source["failedRequests"];
	    }
	}
	export class VerifyOpenAICompatibleProviderInput {
	    baseUrl: string;
	    apiKey: string;
	    model: string;
	    headers?: Record<string, string>;

	    static createFrom(source: any = {}) {
	        return new VerifyOpenAICompatibleProviderInput(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseUrl = source["baseUrl"];
	        this.apiKey = source["apiKey"];
	        this.model = source["model"];
	        this.headers = source["headers"];
	    }
	}
	export class VerifyOpenAICompatibleProviderResult {
	    success: boolean;
	    statusCode?: number;
	    message?: string;
	    responseBody?: string;

	    static createFrom(source: any = {}) {
	        return new VerifyOpenAICompatibleProviderResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.statusCode = source["statusCode"];
	        this.message = source["message"];
	        this.responseBody = source["responseBody"];
	    }
	}

}

export namespace sidecar {

	export class Status {
	    code: string;
	    port: number;
	    message: string;
	    version: string;
	    startedAtUnix: number;

	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.port = source["port"];
	        this.message = source["message"];
	        this.version = source["version"];
	        this.startedAtUnix = source["startedAtUnix"];
	    }
	}

}

export namespace updater {

	export class ReleaseInfo {
	    version: string;
	    releaseUrl: string;
	    assetName: string;
	    releaseNote: string;

	    static createFrom(source: any = {}) {
	        return new ReleaseInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.releaseUrl = source["releaseUrl"];
	        this.assetName = source["assetName"];
	        this.releaseNote = source["releaseNote"];
	    }
	}

}

