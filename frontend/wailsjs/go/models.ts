export namespace codexbinary {
	
	export class DoctorSummary {
	    severity: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new DoctorSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.severity = source["severity"];
	        this.message = source["message"];
	    }
	}
	export class SourceView {
	    id: string;
	    type: string;
	    name: string;
	    enabled: boolean;
	    repo?: string;
	
	    static createFrom(source: any = {}) {
	        return new SourceView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.repo = source["repo"];
	    }
	}
	export class DownloadTaskView {
	    id: string;
	    sourceID: string;
	    tag: string;
	    version: string;
	    status: string;
	    phase: string;
	    bytesDone: number;
	    bytesTotal: number;
	    installAfterDownload: boolean;
	    activateAfterInstall: boolean;
	    errorCode?: string;
	    errorMessage?: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadTaskView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sourceID = source["sourceID"];
	        this.tag = source["tag"];
	        this.version = source["version"];
	        this.status = source["status"];
	        this.phase = source["phase"];
	        this.bytesDone = source["bytesDone"];
	        this.bytesTotal = source["bytesTotal"];
	        this.installAfterDownload = source["installAfterDownload"];
	        this.activateAfterInstall = source["activateAfterInstall"];
	        this.errorCode = source["errorCode"];
	        this.errorMessage = source["errorMessage"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class VersionRowView {
	    rowID: string;
	    version: string;
	    tag?: string;
	    sourceID: string;
	    installedVersionID?: string;
	    isInstalled: boolean;
	    isSelected: boolean;
	    isRollback: boolean;
	    hasRemote: boolean;
	    htmlURL?: string;
	    assetSize?: number;
	    publishedAt?: string;
	    installedAt?: string;
	    isPrerelease?: boolean;
	    notesState: string;
	    task?: DownloadTaskView;
	    primaryAction: string;
	    secondaryAction?: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionRowView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rowID = source["rowID"];
	        this.version = source["version"];
	        this.tag = source["tag"];
	        this.sourceID = source["sourceID"];
	        this.installedVersionID = source["installedVersionID"];
	        this.isInstalled = source["isInstalled"];
	        this.isSelected = source["isSelected"];
	        this.isRollback = source["isRollback"];
	        this.hasRemote = source["hasRemote"];
	        this.htmlURL = source["htmlURL"];
	        this.assetSize = source["assetSize"];
	        this.publishedAt = source["publishedAt"];
	        this.installedAt = source["installedAt"];
	        this.isPrerelease = source["isPrerelease"];
	        this.notesState = source["notesState"];
	        this.task = this.convertValues(source["task"], DownloadTaskView);
	        this.primaryAction = source["primaryAction"];
	        this.secondaryAction = source["secondaryAction"];
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
	export class RemoteVersionView {
	    sourceID: string;
	    version: string;
	    tag: string;
	    title: string;
	    downloadURL: string;
	    htmlURL?: string;
	    assetName?: string;
	    assetSize?: number;
	    publishedAt?: string;
	    isPrerelease: boolean;
	    isInstalled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RemoteVersionView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceID = source["sourceID"];
	        this.version = source["version"];
	        this.tag = source["tag"];
	        this.title = source["title"];
	        this.downloadURL = source["downloadURL"];
	        this.htmlURL = source["htmlURL"];
	        this.assetName = source["assetName"];
	        this.assetSize = source["assetSize"];
	        this.publishedAt = source["publishedAt"];
	        this.isPrerelease = source["isPrerelease"];
	        this.isInstalled = source["isInstalled"];
	    }
	}
	export class VersionView {
	    id: string;
	    displayName: string;
	    detectedVersion: string;
	    releaseTag?: string;
	    sourceID: string;
	    sourceType: string;
	    sourceURL?: string;
	    installedAt: string;
	    lastActivatedAt?: string;
	    isSelected: boolean;
	    existsOnDisk: boolean;
	    binaryRelativePath?: string;
	    binaryPath?: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.displayName = source["displayName"];
	        this.detectedVersion = source["detectedVersion"];
	        this.releaseTag = source["releaseTag"];
	        this.sourceID = source["sourceID"];
	        this.sourceType = source["sourceType"];
	        this.sourceURL = source["sourceURL"];
	        this.installedAt = source["installedAt"];
	        this.lastActivatedAt = source["lastActivatedAt"];
	        this.isSelected = source["isSelected"];
	        this.existsOnDisk = source["existsOnDisk"];
	        this.binaryRelativePath = source["binaryRelativePath"];
	        this.binaryPath = source["binaryPath"];
	    }
	}
	export class ManagedConfigView {
	    binDir: string;
	    binPath: string;
	    enableCommand: string;
	    profilePath?: string;
	    profileKind?: string;
	    isPathConfigured: boolean;
	    resolvedCodexPath?: string;
	    isResolvedToManaged: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ManagedConfigView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.binDir = source["binDir"];
	        this.binPath = source["binPath"];
	        this.enableCommand = source["enableCommand"];
	        this.profilePath = source["profilePath"];
	        this.profileKind = source["profileKind"];
	        this.isPathConfigured = source["isPathConfigured"];
	        this.resolvedCodexPath = source["resolvedCodexPath"];
	        this.isResolvedToManaged = source["isResolvedToManaged"];
	    }
	}
	export class Snapshot {
	    manifestPath: string;
	    managedBinPath: string;
	    managedConfig: ManagedConfigView;
	    selectedVersionID?: string;
	    currentVersion?: VersionView;
	    versions: VersionView[];
	    remoteVersions: RemoteVersionView[];
	    versionRows: VersionRowView[];
	    downloadTasks: DownloadTaskView[];
	    sources: SourceView[];
	    doctor: DoctorSummary;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifestPath = source["manifestPath"];
	        this.managedBinPath = source["managedBinPath"];
	        this.managedConfig = this.convertValues(source["managedConfig"], ManagedConfigView);
	        this.selectedVersionID = source["selectedVersionID"];
	        this.currentVersion = this.convertValues(source["currentVersion"], VersionView);
	        this.versions = this.convertValues(source["versions"], VersionView);
	        this.remoteVersions = this.convertValues(source["remoteVersions"], RemoteVersionView);
	        this.versionRows = this.convertValues(source["versionRows"], VersionRowView);
	        this.downloadTasks = this.convertValues(source["downloadTasks"], DownloadTaskView);
	        this.sources = this.convertValues(source["sources"], SourceView);
	        this.doctor = this.convertValues(source["doctor"], DoctorSummary);
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
	export class DeleteVersionResult {
	    deletedVersionID: string;
	    snapshot: Snapshot;
	
	    static createFrom(source: any = {}) {
	        return new DeleteVersionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.deletedVersionID = source["deletedVersionID"];
	        this.snapshot = this.convertValues(source["snapshot"], Snapshot);
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
	
	export class DownloadInput {
	    sourceID: string;
	    tag: string;
	    activateAfterInstall: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DownloadInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceID = source["sourceID"];
	        this.tag = source["tag"];
	        this.activateAfterInstall = source["activateAfterInstall"];
	    }
	}
	export class DownloadResult {
	    version: VersionView;
	    alreadyInstalled: boolean;
	    activated: boolean;
	    snapshot: Snapshot;
	
	    static createFrom(source: any = {}) {
	        return new DownloadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = this.convertValues(source["version"], VersionView);
	        this.alreadyInstalled = source["alreadyInstalled"];
	        this.activated = source["activated"];
	        this.snapshot = this.convertValues(source["snapshot"], Snapshot);
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
	
	export class EnableManagedPathResult {
	    profilePath: string;
	    backupPath?: string;
	    changed: boolean;
	    messages: string[];
	    snapshot: Snapshot;
	
	    static createFrom(source: any = {}) {
	        return new EnableManagedPathResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profilePath = source["profilePath"];
	        this.backupPath = source["backupPath"];
	        this.changed = source["changed"];
	        this.messages = source["messages"];
	        this.snapshot = this.convertValues(source["snapshot"], Snapshot);
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
	export class ImportLocalInput {
	    Path: string;
	    SourceID: string;
	    SourceType: string;
	    SourceURL: string;
	    ReleaseTag: string;
	    ActivateAfterInstall: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ImportLocalInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Path = source["Path"];
	        this.SourceID = source["SourceID"];
	        this.SourceType = source["SourceType"];
	        this.SourceURL = source["SourceURL"];
	        this.ReleaseTag = source["ReleaseTag"];
	        this.ActivateAfterInstall = source["ActivateAfterInstall"];
	    }
	}
	export class InstallResult {
	    version: VersionView;
	    alreadyInstalled: boolean;
	    activated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = this.convertValues(source["version"], VersionView);
	        this.alreadyInstalled = source["alreadyInstalled"];
	        this.activated = source["activated"];
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
	
	
	
	
	export class UseInput {
	    versionID: string;
	    expectedCurrentVersionID?: string;
	
	    static createFrom(source: any = {}) {
	        return new UseInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.versionID = source["versionID"];
	        this.expectedCurrentVersionID = source["expectedCurrentVersionID"];
	    }
	}
	export class UseResult {
	    selectedVersionID: string;
	    snapshot: Snapshot;
	
	    static createFrom(source: any = {}) {
	        return new UseResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.selectedVersionID = source["selectedVersionID"];
	        this.snapshot = this.convertValues(source["snapshot"], Snapshot);
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
	export class VersionActionInput {
	    versionID: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionActionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.versionID = source["versionID"];
	    }
	}
	export class VersionNotesInput {
	    sourceID: string;
	    tag: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionNotesInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceID = source["sourceID"];
	        this.tag = source["tag"];
	    }
	}
	export class VersionNotesView {
	    sourceID: string;
	    tag: string;
	    version: string;
	    title: string;
	    htmlURL?: string;
	    publishedAt?: string;
	    bodyMarkdown: string;
	    bodyPlainText?: string;
	    source: string;
	    truncated: boolean;
	    fetchedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionNotesView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceID = source["sourceID"];
	        this.tag = source["tag"];
	        this.version = source["version"];
	        this.title = source["title"];
	        this.htmlURL = source["htmlURL"];
	        this.publishedAt = source["publishedAt"];
	        this.bodyMarkdown = source["bodyMarkdown"];
	        this.bodyPlainText = source["bodyPlainText"];
	        this.source = source["source"];
	        this.truncated = source["truncated"];
	        this.fetchedAt = source["fetchedAt"];
	    }
	}
	

}

export namespace main {
	
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
	    apiKeys?: string[];
	    headers?: Record<string, string>;
	    models?: OpenAICompatibleModel[];
	    keyFingerprint?: string;
	    keySuffix?: string;
	    baseUrl?: string;
	    prefix?: string;
	    proxyUrl?: string;
	    authIndex?: any;
	    quotaKey?: string;
	    quotaCurl?: string;
	    quotaEnabled?: boolean;
	    localOnly?: boolean;
	    supportedFormats?: string[];
	    formatBaseUrls?: Record<string, string>;
	    billingCurl?: string;
	    billingEnabled?: boolean;
	
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
	        this.apiKeys = source["apiKeys"];
	        this.headers = source["headers"];
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	        this.keyFingerprint = source["keyFingerprint"];
	        this.keySuffix = source["keySuffix"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.proxyUrl = source["proxyUrl"];
	        this.authIndex = source["authIndex"];
	        this.quotaKey = source["quotaKey"];
	        this.quotaCurl = source["quotaCurl"];
	        this.quotaEnabled = source["quotaEnabled"];
	        this.localOnly = source["localOnly"];
	        this.supportedFormats = source["supportedFormats"];
	        this.formatBaseUrls = source["formatBaseUrls"];
	        this.billingCurl = source["billingCurl"];
	        this.billingEnabled = source["billingEnabled"];
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
	export class AppRuntimeSettings {
	    launchAtLogin: boolean;
	    launchAtLoginSupported: boolean;
	    launchAgentPath?: string;
	    closeAction: string;
	    menuBarResident: boolean;
	    configPath?: string;
	
	    static createFrom(source: any = {}) {
	        return new AppRuntimeSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.launchAtLogin = source["launchAtLogin"];
	        this.launchAtLoginSupported = source["launchAtLoginSupported"];
	        this.launchAgentPath = source["launchAgentPath"];
	        this.closeAction = source["closeAction"];
	        this.menuBarResident = source["menuBarResident"];
	        this.configPath = source["configPath"];
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
	export class ClaudeCodeAccountRoutingProbeAttempt {
	    index: number;
	    success: boolean;
	    statusCode?: number;
	    accountID?: string;
	    accountLabel?: string;
	    provider?: string;
	    message?: string;
	    evidence?: string;
	    responseBody?: string;
	    startedAt?: string;
	    finishedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeAccountRoutingProbeAttempt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.success = source["success"];
	        this.statusCode = source["statusCode"];
	        this.accountID = source["accountID"];
	        this.accountLabel = source["accountLabel"];
	        this.provider = source["provider"];
	        this.message = source["message"];
	        this.evidence = source["evidence"];
	        this.responseBody = source["responseBody"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	    }
	}
	export class ClaudeCodeAccountRoutingProbeResult {
	    model: string;
	    attempts: ClaudeCodeAccountRoutingProbeAttempt[];
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeAccountRoutingProbeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.attempts = this.convertValues(source["attempts"], ClaudeCodeAccountRoutingProbeAttempt);
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
	export class ClaudeCodeMcpAsset {
	    id: string;
	    label: string;
	    transport: string;
	    scope: string;
	    sourcePath: string;
	    endpoint: string;
	    active: boolean;
	    secretState: string;
	    dirty?: boolean;
	    shadowedBy?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeMcpAsset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.transport = source["transport"];
	        this.scope = source["scope"];
	        this.sourcePath = source["sourcePath"];
	        this.endpoint = source["endpoint"];
	        this.active = source["active"];
	        this.secretState = source["secretState"];
	        this.dirty = source["dirty"];
	        this.shadowedBy = source["shadowedBy"];
	    }
	}
	export class ClaudeCodeSkillAsset {
	    id: string;
	    name: string;
	    description: string;
	    scope: string;
	    path: string;
	    frontmatterStatus: string;
	    invocation: string;
	    modelInvocation: string;
	    removable: boolean;
	    fileCount: number;
	    risk?: string;
	    previewMarkdown?: string;
	    frontmatterError?: string;
	    legacyCommandSource?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSkillAsset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.scope = source["scope"];
	        this.path = source["path"];
	        this.frontmatterStatus = source["frontmatterStatus"];
	        this.invocation = source["invocation"];
	        this.modelInvocation = source["modelInvocation"];
	        this.removable = source["removable"];
	        this.fileCount = source["fileCount"];
	        this.risk = source["risk"];
	        this.previewMarkdown = source["previewMarkdown"];
	        this.frontmatterError = source["frontmatterError"];
	        this.legacyCommandSource = source["legacyCommandSource"];
	    }
	}
	export class ClaudeCodeExtensionsSnapshot {
	    claudeConfigDirPath: string;
	    claudeJsonPath: string;
	    projectPath: string;
	    skills: ClaudeCodeSkillAsset[];
	    mcpServers: ClaudeCodeMcpAsset[];
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeExtensionsSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.claudeConfigDirPath = source["claudeConfigDirPath"];
	        this.claudeJsonPath = source["claudeJsonPath"];
	        this.projectPath = source["projectPath"];
	        this.skills = this.convertValues(source["skills"], ClaudeCodeSkillAsset);
	        this.mcpServers = this.convertValues(source["mcpServers"], ClaudeCodeMcpAsset);
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
	export class ClaudeCodeLocalApplyOptions {
	    model?: string;
	    defaultHaikuModel?: string;
	    defaultSonnetModel?: string;
	    defaultOpusModel?: string;
	    smallFastModel?: string;
	    maxOutputTokens?: string;
	    apiTimeoutMs?: string;
	    disableNonEssentialTraffic?: boolean;
	    claudeCodeAttributionHeader?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeLocalApplyOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.defaultHaikuModel = source["defaultHaikuModel"];
	        this.defaultSonnetModel = source["defaultSonnetModel"];
	        this.defaultOpusModel = source["defaultOpusModel"];
	        this.smallFastModel = source["smallFastModel"];
	        this.maxOutputTokens = source["maxOutputTokens"];
	        this.apiTimeoutMs = source["apiTimeoutMs"];
	        this.disableNonEssentialTraffic = source["disableNonEssentialTraffic"];
	        this.claudeCodeAttributionHeader = source["claudeCodeAttributionHeader"];
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
	
	export class ClaudeCodeMcpChange {
	    key: string;
	    before: string;
	    after: string;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeMcpChange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.before = source["before"];
	        this.after = source["after"];
	    }
	}
	export class ClaudeCodeMemoryFileImportDTO {
	    raw: string;
	    resolved: string;
	    exists: boolean;
	    depth: number;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeMemoryFileImportDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.raw = source["raw"];
	        this.resolved = source["resolved"];
	        this.exists = source["exists"];
	        this.depth = source["depth"];
	    }
	}
	export class ClaudeCodeMemoryFileRecordDTO {
	    scope: string;
	    path: string;
	    exists: boolean;
	    gitIgnored?: boolean;
	    imports?: ClaudeCodeMemoryFileImportDTO[];
	    content?: string;
	    contentTruncated?: boolean;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeMemoryFileRecordDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scope = source["scope"];
	        this.path = source["path"];
	        this.exists = source["exists"];
	        this.gitIgnored = source["gitIgnored"];
	        this.imports = this.convertValues(source["imports"], ClaudeCodeMemoryFileImportDTO);
	        this.content = source["content"];
	        this.contentTruncated = source["contentTruncated"];
	        this.size = source["size"];
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
	export class ClaudeCodeMemoryFilesSnapshotDTO {
	    projectPath: string;
	    files: ClaudeCodeMemoryFileRecordDTO[];
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeMemoryFilesSnapshotDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectPath = source["projectPath"];
	        this.files = this.convertValues(source["files"], ClaudeCodeMemoryFileRecordDTO);
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
	export class ClaudeCodeSettingsChangeDTO {
	    key: string;
	    before: any;
	    after: any;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSettingsChangeDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.before = source["before"];
	        this.after = source["after"];
	    }
	}
	export class ClaudeCodeSettingsFieldsDTO {
	    env?: Record<string, string>;
	    permissions?: Record<string, any>;
	    disableAllHooks?: boolean;
	    outputStyle?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSettingsFieldsDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.env = source["env"];
	        this.permissions = source["permissions"];
	        this.disableAllHooks = source["disableAllHooks"];
	        this.outputStyle = source["outputStyle"];
	    }
	}
	export class ClaudeCodeSettingsLayer {
	    scope: string;
	    path: string;
	    exists: boolean;
	    parseError?: string;
	    knownFields?: ClaudeCodeSettingsFieldsDTO;
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSettingsLayer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scope = source["scope"];
	        this.path = source["path"];
	        this.exists = source["exists"];
	        this.parseError = source["parseError"];
	        this.knownFields = this.convertValues(source["knownFields"], ClaudeCodeSettingsFieldsDTO);
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
	export class ClaudeCodeSettingsSnapshotDTO {
	    projectPath: string;
	    layers: ClaudeCodeSettingsLayer[];
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSettingsSnapshotDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectPath = source["projectPath"];
	        this.layers = this.convertValues(source["layers"], ClaudeCodeSettingsLayer);
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
	
	export class ClaudeCodeSubagentRecordDTO {
	    name: string;
	    description: string;
	    path: string;
	    scope: string;
	    frontmatterValid: boolean;
	    frontmatterError?: string;
	    validationErrors?: string[];
	    knownFields?: Record<string, any>;
	    unknownFields?: Record<string, any>;
	    body?: string;
	    bodyPreview?: string;
	    isPlugin?: boolean;
	    ignoredFields?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSubagentRecordDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.path = source["path"];
	        this.scope = source["scope"];
	        this.frontmatterValid = source["frontmatterValid"];
	        this.frontmatterError = source["frontmatterError"];
	        this.validationErrors = source["validationErrors"];
	        this.knownFields = source["knownFields"];
	        this.unknownFields = source["unknownFields"];
	        this.body = source["body"];
	        this.bodyPreview = source["bodyPreview"];
	        this.isPlugin = source["isPlugin"];
	        this.ignoredFields = source["ignoredFields"];
	    }
	}
	export class ClaudeCodeSubagentsSnapshotDTO {
	    userPath: string;
	    projectPath: string;
	    agents: ClaudeCodeSubagentRecordDTO[];
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClaudeCodeSubagentsSnapshotDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userPath = source["userPath"];
	        this.projectPath = source["projectPath"];
	        this.agents = this.convertValues(source["agents"], ClaudeCodeSubagentRecordDTO);
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
	export class CodexAccountRoutingProbeAttempt {
	    index: number;
	    success: boolean;
	    statusCode?: number;
	    accountID?: string;
	    accountLabel?: string;
	    provider?: string;
	    message?: string;
	    evidence?: string;
	    responseBody?: string;
	    startedAt?: string;
	    finishedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new CodexAccountRoutingProbeAttempt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.success = source["success"];
	        this.statusCode = source["statusCode"];
	        this.accountID = source["accountID"];
	        this.accountLabel = source["accountLabel"];
	        this.provider = source["provider"];
	        this.message = source["message"];
	        this.evidence = source["evidence"];
	        this.responseBody = source["responseBody"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	    }
	}
	export class CodexAccountRoutingProbeResult {
	    model: string;
	    attempts: CodexAccountRoutingProbeAttempt[];
	
	    static createFrom(source: any = {}) {
	        return new CodexAccountRoutingProbeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.attempts = this.convertValues(source["attempts"], CodexAccountRoutingProbeAttempt);
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
	export class CodexConfigTomlDocument {
	    configPath: string;
	    content: string;
	    exists: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CodexConfigTomlDocument(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.content = source["content"];
	        this.exists = source["exists"];
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
	
	export class CodexLiveErrorSummary {
	    statusCode?: number;
	    code?: string;
	    message: string;
	    retryable?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveErrorSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusCode = source["statusCode"];
	        this.code = source["code"];
	        this.message = source["message"];
	        this.retryable = source["retryable"];
	    }
	}
	export class CodexLiveTimelineEvent {
	    id: string;
	    at: string;
	    lane: string;
	    kind: string;
	    label: string;
	    severity: string;
	    detail?: string;
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveTimelineEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.at = source["at"];
	        this.lane = source["lane"];
	        this.kind = source["kind"];
	        this.label = source["label"];
	        this.severity = source["severity"];
	        this.detail = source["detail"];
	    }
	}
	export class CodexLiveTimingMetrics {
	    queueWaitMs?: number;
	    authSelectMs?: number;
	    upstreamConnectMs?: number;
	    firstEventMs?: number;
	    firstTokenMs?: number;
	    averageEventGapMs?: number;
	    longestEventGapMs?: number;
	    streamDurationMs?: number;
	    totalDurationMs?: number;
	    reconnectCount?: number;
	    outputTokensPerSecond?: number;
	    totalTokensPerSecond?: number;
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveTimingMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueWaitMs = source["queueWaitMs"];
	        this.authSelectMs = source["authSelectMs"];
	        this.upstreamConnectMs = source["upstreamConnectMs"];
	        this.firstEventMs = source["firstEventMs"];
	        this.firstTokenMs = source["firstTokenMs"];
	        this.averageEventGapMs = source["averageEventGapMs"];
	        this.longestEventGapMs = source["longestEventGapMs"];
	        this.streamDurationMs = source["streamDurationMs"];
	        this.totalDurationMs = source["totalDurationMs"];
	        this.reconnectCount = source["reconnectCount"];
	        this.outputTokensPerSecond = source["outputTokensPerSecond"];
	        this.totalTokensPerSecond = source["totalTokensPerSecond"];
	    }
	}
	export class CodexLiveTokenUsage {
	    inputTokens: number;
	    cachedInputTokens: number;
	    outputTokens: number;
	    totalTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveTokenUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputTokens = source["inputTokens"];
	        this.cachedInputTokens = source["cachedInputTokens"];
	        this.outputTokens = source["outputTokens"];
	        this.totalTokens = source["totalTokens"];
	    }
	}
	export class CodexLiveRequest {
	    requestID: string;
	    clientRequestID?: string;
	    upstreamRequestID?: string;
	    sessionID: string;
	    sequence: number;
	    model: string;
	    status: string;
	    startedAt: string;
	    completedAt?: string;
	    downstreamTransport: string;
	    upstreamTransport: string;
	    connectionReused?: boolean;
	    authID?: string;
	    authLabel?: string;
	    provider?: string;
	    proxyRoute?: string;
	    usage?: CodexLiveTokenUsage;
	    timing?: CodexLiveTimingMetrics;
	    error?: CodexLiveErrorSummary;
	    timeline: CodexLiveTimelineEvent[];
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestID = source["requestID"];
	        this.clientRequestID = source["clientRequestID"];
	        this.upstreamRequestID = source["upstreamRequestID"];
	        this.sessionID = source["sessionID"];
	        this.sequence = source["sequence"];
	        this.model = source["model"];
	        this.status = source["status"];
	        this.startedAt = source["startedAt"];
	        this.completedAt = source["completedAt"];
	        this.downstreamTransport = source["downstreamTransport"];
	        this.upstreamTransport = source["upstreamTransport"];
	        this.connectionReused = source["connectionReused"];
	        this.authID = source["authID"];
	        this.authLabel = source["authLabel"];
	        this.provider = source["provider"];
	        this.proxyRoute = source["proxyRoute"];
	        this.usage = this.convertValues(source["usage"], CodexLiveTokenUsage);
	        this.timing = this.convertValues(source["timing"], CodexLiveTimingMetrics);
	        this.error = this.convertValues(source["error"], CodexLiveErrorSummary);
	        this.timeline = this.convertValues(source["timeline"], CodexLiveTimelineEvent);
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
	export class CodexLiveSession {
	    sessionID: string;
	    executionSessionID?: string;
	    downstreamSessionID?: string;
	    codexWindowID?: string;
	    status: string;
	    startedAt: string;
	    lastEventAt: string;
	    durationMs: number;
	    requestCount: number;
	    activeRequestID?: string;
	    lastRequestID?: string;
	    model: string;
	    authID?: string;
	    authLabel?: string;
	    provider?: string;
	    downstreamTransport: string;
	    upstreamTransport: string;
	    fallbackInferred?: boolean;
	    fallbackConfidence?: string;
	    fallbackReason?: string;
	    recentEvents: CodexLiveTimelineEvent[];
	    requests: CodexLiveRequest[];
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionID = source["sessionID"];
	        this.executionSessionID = source["executionSessionID"];
	        this.downstreamSessionID = source["downstreamSessionID"];
	        this.codexWindowID = source["codexWindowID"];
	        this.status = source["status"];
	        this.startedAt = source["startedAt"];
	        this.lastEventAt = source["lastEventAt"];
	        this.durationMs = source["durationMs"];
	        this.requestCount = source["requestCount"];
	        this.activeRequestID = source["activeRequestID"];
	        this.lastRequestID = source["lastRequestID"];
	        this.model = source["model"];
	        this.authID = source["authID"];
	        this.authLabel = source["authLabel"];
	        this.provider = source["provider"];
	        this.downstreamTransport = source["downstreamTransport"];
	        this.upstreamTransport = source["upstreamTransport"];
	        this.fallbackInferred = source["fallbackInferred"];
	        this.fallbackConfidence = source["fallbackConfidence"];
	        this.fallbackReason = source["fallbackReason"];
	        this.recentEvents = this.convertValues(source["recentEvents"], CodexLiveTimelineEvent);
	        this.requests = this.convertValues(source["requests"], CodexLiveRequest);
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
	export class CodexLiveSessionSummary {
	    activeSessions: number;
	    activeRequests: number;
	    websocketSessions: number;
	    httpSessions: number;
	    degradedSessions: number;
	    errorSessions: number;
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveSessionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.activeSessions = source["activeSessions"];
	        this.activeRequests = source["activeRequests"];
	        this.websocketSessions = source["websocketSessions"];
	        this.httpSessions = source["httpSessions"];
	        this.degradedSessions = source["degradedSessions"];
	        this.errorSessions = source["errorSessions"];
	    }
	}
	export class CodexLiveSessionsSnapshot {
	    generatedAt: string;
	    sidecarReady: boolean;
	    source: string;
	    retentionLabel: string;
	    summary: CodexLiveSessionSummary;
	    sessions: CodexLiveSession[];
	
	    static createFrom(source: any = {}) {
	        return new CodexLiveSessionsSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.generatedAt = source["generatedAt"];
	        this.sidecarReady = source["sidecarReady"];
	        this.source = source["source"];
	        this.retentionLabel = source["retentionLabel"];
	        this.summary = this.convertValues(source["summary"], CodexLiveSessionSummary);
	        this.sessions = this.convertValues(source["sessions"], CodexLiveSession);
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
	
	
	
	export class CodexMcpChange {
	    key: string;
	    before: string;
	    after: string;
	
	    static createFrom(source: any = {}) {
	        return new CodexMcpChange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.before = source["before"];
	        this.after = source["after"];
	    }
	}
	export class CodexMcpEnvRow {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new CodexMcpEnvRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class CodexMcpToolRow {
	    name: string;
	    approvalMode?: string;
	
	    static createFrom(source: any = {}) {
	        return new CodexMcpToolRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.approvalMode = source["approvalMode"];
	    }
	}
	export class CodexMcpServer {
	    id: string;
	    label: string;
	    enabled: boolean;
	    transport: string;
	    command?: string;
	    args?: string[];
	    env?: CodexMcpEnvRow[];
	    envVarsRaw?: string;
	    cwd?: string;
	    url?: string;
	    bearerTokenEnvVar?: string;
	    httpHeaders?: CodexMcpEnvRow[];
	    envHttpHeaders?: CodexMcpEnvRow[];
	    experimentalEnvironment?: string;
	    required?: boolean;
	    supportsParallelToolCalls?: boolean;
	    startupTimeoutSec?: string;
	    toolTimeoutSec?: string;
	    defaultToolsApprovalMode?: string;
	    enabledTools?: string[];
	    disabledTools?: string[];
	    scopes?: string[];
	    oauthResource?: string;
	    tools?: CodexMcpToolRow[];
	    rawConfig?: string;
	    sourcePath: string;
	    status: string;
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CodexMcpServer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.enabled = source["enabled"];
	        this.transport = source["transport"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.env = this.convertValues(source["env"], CodexMcpEnvRow);
	        this.envVarsRaw = source["envVarsRaw"];
	        this.cwd = source["cwd"];
	        this.url = source["url"];
	        this.bearerTokenEnvVar = source["bearerTokenEnvVar"];
	        this.httpHeaders = this.convertValues(source["httpHeaders"], CodexMcpEnvRow);
	        this.envHttpHeaders = this.convertValues(source["envHttpHeaders"], CodexMcpEnvRow);
	        this.experimentalEnvironment = source["experimentalEnvironment"];
	        this.required = source["required"];
	        this.supportsParallelToolCalls = source["supportsParallelToolCalls"];
	        this.startupTimeoutSec = source["startupTimeoutSec"];
	        this.toolTimeoutSec = source["toolTimeoutSec"];
	        this.defaultToolsApprovalMode = source["defaultToolsApprovalMode"];
	        this.enabledTools = source["enabledTools"];
	        this.disabledTools = source["disabledTools"];
	        this.scopes = source["scopes"];
	        this.oauthResource = source["oauthResource"];
	        this.tools = this.convertValues(source["tools"], CodexMcpToolRow);
	        this.rawConfig = source["rawConfig"];
	        this.sourcePath = source["sourcePath"];
	        this.status = source["status"];
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
	export class CodexMcpServersSnapshot {
	    codexHomePath: string;
	    configPath: string;
	    exists: boolean;
	    servers: CodexMcpServer[];
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CodexMcpServersSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codexHomePath = source["codexHomePath"];
	        this.configPath = source["configPath"];
	        this.exists = source["exists"];
	        this.servers = this.convertValues(source["servers"], CodexMcpServer);
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
	
	export class CodexQuotaBillingBalanceInfo {
	    currency: string;
	    totalBalance: string;
	    grantedBalance: string;
	    toppedUpBalance: string;
	
	    static createFrom(source: any = {}) {
	        return new CodexQuotaBillingBalanceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currency = source["currency"];
	        this.totalBalance = source["totalBalance"];
	        this.grantedBalance = source["grantedBalance"];
	        this.toppedUpBalance = source["toppedUpBalance"];
	    }
	}
	export class CodexQuotaBillingInfo {
	    isAvailable: boolean;
	    balanceInfos: CodexQuotaBillingBalanceInfo[];
	
	    static createFrom(source: any = {}) {
	        return new CodexQuotaBillingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isAvailable = source["isAvailable"];
	        this.balanceInfos = this.convertValues(source["balanceInfos"], CodexQuotaBillingBalanceInfo);
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
	    billing?: CodexQuotaBillingInfo;
	
	    static createFrom(source: any = {}) {
	        return new CodexQuotaResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.planType = source["planType"];
	        this.windows = this.convertValues(source["windows"], CodexQuotaWindow);
	        this.billing = this.convertValues(source["billing"], CodexQuotaBillingInfo);
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
	
	export class CodexSkillFile {
	    path: string;
	    kind: string;
	    content?: string;
	    previewable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CodexSkillFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.kind = source["kind"];
	        this.content = source["content"];
	        this.previewable = source["previewable"];
	    }
	}
	export class CodexSkillRecord {
	    id: string;
	    name: string;
	    description?: string;
	    enabled: boolean;
	    rootLabel: string;
	    rootPath: string;
	    sourceKind: string;
	    origin: string;
	    versionLabel?: string;
	    files: CodexSkillFile[];
	    skillMarkdown: string;
	    previewMarkdown: string;
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CodexSkillRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.enabled = source["enabled"];
	        this.rootLabel = source["rootLabel"];
	        this.rootPath = source["rootPath"];
	        this.sourceKind = source["sourceKind"];
	        this.origin = source["origin"];
	        this.versionLabel = source["versionLabel"];
	        this.files = this.convertValues(source["files"], CodexSkillFile);
	        this.skillMarkdown = source["skillMarkdown"];
	        this.previewMarkdown = source["previewMarkdown"];
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
	export class CodexSkillRoot {
	    label: string;
	    path: string;
	    sourceKind: string;
	    exists: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CodexSkillRoot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.path = source["path"];
	        this.sourceKind = source["sourceKind"];
	        this.exists = source["exists"];
	    }
	}
	export class CodexSkillsSnapshot {
	    codexHomePath: string;
	    configPath: string;
	    roots: CodexSkillRoot[];
	    skills: CodexSkillRecord[];
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CodexSkillsSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codexHomePath = source["codexHomePath"];
	        this.configPath = source["configPath"];
	        this.roots = this.convertValues(source["roots"], CodexSkillRoot);
	        this.skills = this.convertValues(source["skills"], CodexSkillRecord);
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
	    formatBaseUrls?: Record<string, string>;
	    priority?: number;
	    prefix?: string;
	    proxyUrl?: string;
	    headers?: Record<string, string>;
	    models?: OpenAICompatibleModel[];
	    excludedModels?: string[];
	    quotaCurl?: string;
	    quotaEnabled?: boolean;
	    billingCurl?: string;
	    billingEnabled?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreateCodexAPIKeyInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.label = source["label"];
	        this.baseUrl = source["baseUrl"];
	        this.formatBaseUrls = source["formatBaseUrls"];
	        this.priority = source["priority"];
	        this.prefix = source["prefix"];
	        this.proxyUrl = source["proxyUrl"];
	        this.headers = source["headers"];
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	        this.excludedModels = source["excludedModels"];
	        this.quotaCurl = source["quotaCurl"];
	        this.quotaEnabled = source["quotaEnabled"];
	        this.billingCurl = source["billingCurl"];
	        this.billingEnabled = source["billingEnabled"];
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
	export class DeleteClaudeCodeSubagentInputDTO {
	    scope: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteClaudeCodeSubagentInputDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scope = source["scope"];
	        this.path = source["path"];
	    }
	}
	export class DeleteRateLimitRuleInput {
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteRateLimitRuleInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
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
	export class GetCodexSkillFilePreviewInput {
	    skillPath: string;
	    filePath: string;
	
	    static createFrom(source: any = {}) {
	        return new GetCodexSkillFilePreviewInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.skillPath = source["skillPath"];
	        this.filePath = source["filePath"];
	    }
	}
	export class GetCodexSkillFilePreviewResult {
	    path: string;
	    content?: string;
	    previewable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GetCodexSkillFilePreviewResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.content = source["content"];
	        this.previewable = source["previewable"];
	    }
	}
	export class LocalCodexAuthState {
	    authFilePath: string;
	    hasAuthFile: boolean;
	    authMode: string;
	    hasOpenAIAPIKey: boolean;
	    hasTokens: boolean;
	    accountEmail?: string;
	    planType?: string;
	    canPreserveChatGPTAuth: boolean;
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new LocalCodexAuthState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.authFilePath = source["authFilePath"];
	        this.hasAuthFile = source["hasAuthFile"];
	        this.authMode = source["authMode"];
	        this.hasOpenAIAPIKey = source["hasOpenAIAPIKey"];
	        this.hasTokens = source["hasTokens"];
	        this.accountEmail = source["accountEmail"];
	        this.planType = source["planType"];
	        this.canPreserveChatGPTAuth = source["canPreserveChatGPTAuth"];
	        this.warnings = source["warnings"];
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
	export class LocalCodexModelProviderStateView {
	    currentProviderID: string;
	    currentProviderName: string;
	    currentProviderIsBuiltin: boolean;
	    currentProviderExists: boolean;
	    providers: LocalCodexModelProviderView[];
	
	    static createFrom(source: any = {}) {
	        return new LocalCodexModelProviderStateView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentProviderID = source["currentProviderID"];
	        this.currentProviderName = source["currentProviderName"];
	        this.currentProviderIsBuiltin = source["currentProviderIsBuiltin"];
	        this.currentProviderExists = source["currentProviderExists"];
	        this.providers = this.convertValues(source["providers"], LocalCodexModelProviderView);
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
	
	export class LocalProjectedUsageDetail {
	    timestamp: string;
	    provider: string;
	    sourceKind: string;
	    sessionID?: string;
	    projectName?: string;
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
	        this.sessionID = source["sessionID"];
	        this.projectName = source["projectName"];
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
	    proxyUrl?: string;
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
	        this.proxyUrl = source["proxyUrl"];
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
	export class OpenCodexConfigTomlResult {
	    configPath: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenCodexConfigTomlResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	    }
	}
	export class OpenCodexSkillInFinderInput {
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenCodexSkillInFinderInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	    }
	}
	export class OpenCodexSkillInFinderResult {
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenCodexSkillInFinderResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	    }
	}
	export class PatchClaudeCodeSettingsInputDTO {
	    scope: string;
	    path: string;
	    patches: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new PatchClaudeCodeSettingsInputDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scope = source["scope"];
	        this.path = source["path"];
	        this.patches = source["patches"];
	    }
	}
	export class PatchClaudeCodeSettingsResultDTO {
	    configPath: string;
	    preview: string;
	    changes: ClaudeCodeSettingsChangeDTO[];
	
	    static createFrom(source: any = {}) {
	        return new PatchClaudeCodeSettingsResultDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.preview = source["preview"];
	        this.changes = this.convertValues(source["changes"], ClaudeCodeSettingsChangeDTO);
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
	export class ProbeClaudeCodeAccountRoutingInput {
	    model: string;
	    attempts?: number;
	    allowAccountIDs?: string[];
	    denyAccountIDs?: string[];
	    orderAccountIDs?: string[];
	    allowFallback?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProbeClaudeCodeAccountRoutingInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.attempts = source["attempts"];
	        this.allowAccountIDs = source["allowAccountIDs"];
	        this.denyAccountIDs = source["denyAccountIDs"];
	        this.orderAccountIDs = source["orderAccountIDs"];
	        this.allowFallback = source["allowFallback"];
	    }
	}
	export class ProbeCodexAccountRoutingInput {
	    model: string;
	    attempts?: number;
	    allowAccountIDs?: string[];
	    denyAccountIDs?: string[];
	    orderAccountIDs?: string[];
	    allowFallback?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProbeCodexAccountRoutingInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.attempts = source["attempts"];
	        this.allowAccountIDs = source["allowAccountIDs"];
	        this.denyAccountIDs = source["denyAccountIDs"];
	        this.orderAccountIDs = source["orderAccountIDs"];
	        this.allowFallback = source["allowFallback"];
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
	export class RateLimitEvent {
	    id: string;
	    accountKey: string;
	    matchKey?: string;
	    ruleID: string;
	    strategy: string;
	    window: string;
	    action: string;
	    usageValue: number;
	    limitValue: number;
	    blocked: boolean;
	    reason?: string;
	    triggeredAt: number;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.accountKey = source["accountKey"];
	        this.matchKey = source["matchKey"];
	        this.ruleID = source["ruleID"];
	        this.strategy = source["strategy"];
	        this.window = source["window"];
	        this.action = source["action"];
	        this.usageValue = source["usageValue"];
	        this.limitValue = source["limitValue"];
	        this.blocked = source["blocked"];
	        this.reason = source["reason"];
	        this.triggeredAt = source["triggeredAt"];
	    }
	}
	export class RateLimitEventsInput {
	    accountKey?: string;
	    limit?: number;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitEventsInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountKey = source["accountKey"];
	        this.limit = source["limit"];
	    }
	}
	export class RateLimitRule {
	    id?: string;
	    accountKey: string;
	    matchKey?: string;
	    strategy: string;
	    window: string;
	    limitValue: number;
	    action: string;
	    enabled: boolean;
	    label?: string;
	    createdAt?: number;
	    updatedAt?: number;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.accountKey = source["accountKey"];
	        this.matchKey = source["matchKey"];
	        this.strategy = source["strategy"];
	        this.window = source["window"];
	        this.limitValue = source["limitValue"];
	        this.action = source["action"];
	        this.enabled = source["enabled"];
	        this.label = source["label"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class RateLimitRuleState {
	    rule: RateLimitRule;
	    exceeded: boolean;
	    reason?: string;
	    usagePct: number;
	    currentUsage: number;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitRuleState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rule = this.convertValues(source["rule"], RateLimitRule);
	        this.exceeded = source["exceeded"];
	        this.reason = source["reason"];
	        this.usagePct = source["usagePct"];
	        this.currentUsage = source["currentUsage"];
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
	export class RateLimitRulesInput {
	    accountKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitRulesInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountKey = source["accountKey"];
	    }
	}
	export class RateLimitState {
	    accountKey: string;
	    matchKey?: string;
	    blocked: boolean;
	    blockReason?: string;
	    rules: RateLimitRuleState[];
	    updatedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountKey = source["accountKey"];
	        this.matchKey = source["matchKey"];
	        this.blocked = source["blocked"];
	        this.blockReason = source["blockReason"];
	        this.rules = this.convertValues(source["rules"], RateLimitRuleState);
	        this.updatedAt = source["updatedAt"];
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
	export class RateLimitStatusInput {
	    accountKey: string;
	
	    static createFrom(source: any = {}) {
	        return new RateLimitStatusInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountKey = source["accountKey"];
	    }
	}
	export class RateLimitStrategyMeta {
	    id: string;
	    name: string;
	    supportedWindows: string[];
	
	    static createFrom(source: any = {}) {
	        return new RateLimitStrategyMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.supportedWindows = source["supportedWindows"];
	    }
	}
	export class RelayLocalApplyInput {
	    apiKey: string;
	    authFileContentBase64?: string;
	    baseURL: string;
	    model: string;
	    reasoningEffort: string;
	    providerID: string;
	    providerName: string;
	    supportsWebsockets: boolean;
	    authStrategy: string;
	    skipRelayKeyMetadata?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RelayLocalApplyInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.authFileContentBase64 = source["authFileContentBase64"];
	        this.baseURL = source["baseURL"];
	        this.model = source["model"];
	        this.reasoningEffort = source["reasoningEffort"];
	        this.providerID = source["providerID"];
	        this.providerName = source["providerName"];
	        this.supportsWebsockets = source["supportsWebsockets"];
	        this.authStrategy = source["authStrategy"];
	        this.skipRelayKeyMetadata = source["skipRelayKeyMetadata"];
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
	export class RemoveCodexSkillInput {
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new RemoveCodexSkillInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	    }
	}
	export class RemoveCodexSkillResult {
	    configPath: string;
	    removedPath: string;
	    preview: string;
	
	    static createFrom(source: any = {}) {
	        return new RemoveCodexSkillResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.removedPath = source["removedPath"];
	        this.preview = source["preview"];
	    }
	}
	export class SaveClaudeCodeMcpServerInput {
	    server: ClaudeCodeMcpAsset;
	
	    static createFrom(source: any = {}) {
	        return new SaveClaudeCodeMcpServerInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = this.convertValues(source["server"], ClaudeCodeMcpAsset);
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
	export class SaveClaudeCodeMcpServerResult {
	    configPath: string;
	    server: ClaudeCodeMcpAsset;
	    preview: string;
	    changes: ClaudeCodeMcpChange[];
	
	    static createFrom(source: any = {}) {
	        return new SaveClaudeCodeMcpServerResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.server = this.convertValues(source["server"], ClaudeCodeMcpAsset);
	        this.preview = source["preview"];
	        this.changes = this.convertValues(source["changes"], ClaudeCodeMcpChange);
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
	export class SaveClaudeCodeMemoryFileInputDTO {
	    path: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveClaudeCodeMemoryFileInputDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.content = source["content"];
	    }
	}
	export class SaveClaudeCodeMemoryFileResultDTO {
	    path: string;
	    size: number;
	    warning?: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveClaudeCodeMemoryFileResultDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	        this.warning = source["warning"];
	    }
	}
	export class SaveClaudeCodeSubagentInputDTO {
	    scope: string;
	    path: string;
	    name: string;
	    description: string;
	    knownFields?: Record<string, any>;
	    unknownFields?: Record<string, any>;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveClaudeCodeSubagentInputDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scope = source["scope"];
	        this.path = source["path"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.knownFields = source["knownFields"];
	        this.unknownFields = source["unknownFields"];
	        this.body = source["body"];
	    }
	}
	export class SaveClaudeCodeSubagentResultDTO {
	    path: string;
	    preview: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveClaudeCodeSubagentResultDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.preview = source["preview"];
	    }
	}
	export class SaveCodexConfigTomlInput {
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveCodexConfigTomlInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	    }
	}
	export class SaveCodexConfigTomlResult {
	    configPath: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveCodexConfigTomlResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.content = source["content"];
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
	export class SaveCodexMcpServerInput {
	    server: CodexMcpServer;
	
	    static createFrom(source: any = {}) {
	        return new SaveCodexMcpServerInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = this.convertValues(source["server"], CodexMcpServer);
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
	export class SaveCodexMcpServerResult {
	    configPath: string;
	    server: CodexMcpServer;
	    preview: string;
	    changes: CodexMcpChange[];
	
	    static createFrom(source: any = {}) {
	        return new SaveCodexMcpServerResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.server = this.convertValues(source["server"], CodexMcpServer);
	        this.preview = source["preview"];
	        this.changes = this.convertValues(source["changes"], CodexMcpChange);
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
	export class SaveCodexSkillEnabledInput {
	    path: string;
	    name?: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SaveCodexSkillEnabledInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	    }
	}
	export class SaveCodexSkillEnabledResult {
	    configPath: string;
	    preview: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveCodexSkillEnabledResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configPath = source["configPath"];
	        this.preview = source["preview"];
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
	export class SidecarProxySettings {
	    useSystemProxy: boolean;
	    configPath: string;
	    appliedToRunningSidecar: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SidecarProxySettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.useSystemProxy = source["useSystemProxy"];
	        this.configPath = source["configPath"];
	        this.appliedToRunningSidecar = source["appliedToRunningSidecar"];
	    }
	}
	export class SidecarUsageAttributionBucket {
	    start: string;
	    requestCount: number;
	    failedCount: number;
	    inputTokens: number;
	    cachedInputTokens: number;
	    outputTokens: number;
	    totalTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new SidecarUsageAttributionBucket(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.start = source["start"];
	        this.requestCount = source["requestCount"];
	        this.failedCount = source["failedCount"];
	        this.inputTokens = source["inputTokens"];
	        this.cachedInputTokens = source["cachedInputTokens"];
	        this.outputTokens = source["outputTokens"];
	        this.totalTokens = source["totalTokens"];
	    }
	}
	export class SidecarUsageAttributionInput {
	    window?: string;
	    bucket?: string;
	    includeUnresolved?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SidecarUsageAttributionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.window = source["window"];
	        this.bucket = source["bucket"];
	        this.includeUnresolved = source["includeUnresolved"];
	    }
	}
	export class SidecarUsageAttributionItem {
	    attributionKey: string;
	    attributionKind: string;
	    accountKey: string;
	    credentialKey?: string;
	    provider: string;
	    requestedModels: string[];
	    requestCount: number;
	    failedCount: number;
	    latencyAverageMs?: number;
	    inputTokens: number;
	    cachedInputTokens: number;
	    outputTokens: number;
	    totalTokens: number;
	    lastActivityAt?: string;
	    buckets: SidecarUsageAttributionBucket[];
	
	    static createFrom(source: any = {}) {
	        return new SidecarUsageAttributionItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.attributionKey = source["attributionKey"];
	        this.attributionKind = source["attributionKind"];
	        this.accountKey = source["accountKey"];
	        this.credentialKey = source["credentialKey"];
	        this.provider = source["provider"];
	        this.requestedModels = source["requestedModels"];
	        this.requestCount = source["requestCount"];
	        this.failedCount = source["failedCount"];
	        this.latencyAverageMs = source["latencyAverageMs"];
	        this.inputTokens = source["inputTokens"];
	        this.cachedInputTokens = source["cachedInputTokens"];
	        this.outputTokens = source["outputTokens"];
	        this.totalTokens = source["totalTokens"];
	        this.lastActivityAt = source["lastActivityAt"];
	        this.buckets = this.convertValues(source["buckets"], SidecarUsageAttributionBucket);
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
	export class SidecarUsageAttributionResponse {
	    window: string;
	    bucket: string;
	    generatedAt: string;
	    items: SidecarUsageAttributionItem[];
	    unresolved?: SidecarUsageAttributionItem[];
	
	    static createFrom(source: any = {}) {
	        return new SidecarUsageAttributionResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.window = source["window"];
	        this.bucket = source["bucket"];
	        this.generatedAt = source["generatedAt"];
	        this.items = this.convertValues(source["items"], SidecarUsageAttributionItem);
	        this.unresolved = this.convertValues(source["unresolved"], SidecarUsageAttributionItem);
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
	    proxyUrl?: string;
	    models?: OpenAICompatibleModel[];
	    quotaCurl?: string;
	    quotaEnabled?: boolean;
	    billingCurl?: string;
	    billingEnabled?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateCodexAPIKeyConfigInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.apiKey = source["apiKey"];
	        this.baseUrl = source["baseUrl"];
	        this.prefix = source["prefix"];
	        this.proxyUrl = source["proxyUrl"];
	        this.models = this.convertValues(source["models"], OpenAICompatibleModel);
	        this.quotaCurl = source["quotaCurl"];
	        this.quotaEnabled = source["quotaEnabled"];
	        this.billingCurl = source["billingCurl"];
	        this.billingEnabled = source["billingEnabled"];
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
	export class UpdateOAuthModelAliasesInput {
	    channel: string;
	    models?: OpenAICompatibleModel[];
	
	    static createFrom(source: any = {}) {
	        return new UpdateOAuthModelAliasesInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.channel = source["channel"];
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
	export class UpdateOpenAICompatibleProviderInput {
	    currentName: string;
	    name: string;
	    baseUrl: string;
	    prefix?: string;
	    proxyUrl?: string;
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
	        this.proxyUrl = source["proxyUrl"];
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
	    snapshot?: SessionManagementSnapshot;
	
	    static createFrom(source: any = {}) {
	        return new UpdateSessionProvidersInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectID = source["projectID"];
	        this.mappings = this.convertValues(source["mappings"], UpdateSessionProviderMapping);
	        this.snapshot = this.convertValues(source["snapshot"], SessionManagementSnapshot);
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

