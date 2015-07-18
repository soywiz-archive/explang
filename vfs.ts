/// <reference path="./defs.d.ts" />

declare function require(name:string):any;
declare class Buffer { constructor(data:any); }
declare var process:any;

export class Vfs {
	get root() {
		return new VfsFile(this, '');
	}
	write(path:string, data:Uint8Array) {
	}
}

export class ProxyVfs extends Vfs {
	protected convert(path:string):VfsFile {
		throw 'Must override';
	}
	write(path:string, data:Uint8Array) { return this.convert(path).write(data); }
}

export class AccessVfs extends ProxyVfs {
	constructor(public base:VfsFile) { super(); }
	protected convert(path:string):VfsFile {
		return this.base.access(path);
	}
}

export class LocalVfs extends Vfs {
	write(path:string, data:Uint8Array) {
		if (require('os').platform() == 'win32') path = path.replace(/^\/+/, '');
		console.log('writting', path, data.length);
		require('fs').writeFileSync(path, new Buffer(data));
	}
}

export class VfsFile {
	constructor(public vfs:Vfs, public path:string) {}
	createVfs() {
		return new AccessVfs(this);
	}
	access(path:string) {
		return new VfsFile(this.vfs, this.path + '/' + path);
	}
	write(data:Uint8Array) { return this.vfs.write(this.path, data); }
}

export const local:VfsFile = new LocalVfs().root;
export function cwd():VfsFile {
	return local.access(process.cwd()).createVfs().root;
}