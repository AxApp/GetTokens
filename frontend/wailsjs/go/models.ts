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

