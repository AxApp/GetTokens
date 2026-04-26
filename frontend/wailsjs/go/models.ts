export namespace main {
	
	export class AccountRecord {
	    id: string;
	    provider: string;
	    credentialSource: string;
	    displayName: string;
	    status: string;
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
	    baseUrl: string;
	    prefix?: string;
	    proxyUrl?: string;
	    headers?: Record<string, string>;
	    excludedModels?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CreateCodexAPIKeyInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.proxyUrl = source["proxyUrl"];
	        this.headers = source["headers"];
	        this.excludedModels = source["excludedModels"];
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
	    endpoints: RelayServiceEndpoint[];
	
	    static createFrom(source: any = {}) {
	        return new RelayServiceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKeys = source["apiKeys"];
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

}

export namespace sidecar {
	
	export class Status {
	    code: string;
	    port: number;
	    message: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.port = source["port"];
	        this.message = source["message"];
	        this.version = source["version"];
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

