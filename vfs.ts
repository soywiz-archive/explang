/// <reference path="./defs.d.ts" />

import utils = require('./utils');

declare function require(name:string):any;
declare class Buffer { constructor(data:any); }
declare var process:any;

export class Vfs {
	get root() {
		return new VfsFile(this, '');
	}
	write(path:string, data:Uint8Array) {
	}
	read(path:string):Uint8Array {
		return null;
	}
}

export class ProxyVfs extends Vfs {
	protected convert(path:string):VfsFile {
		throw 'Must override';
	}
	write(path:string, data:Uint8Array) { return this.convert(path).write(data); }
	read(path:string):Uint8Array { return this.convert(path).read(); }
}

export class AccessVfs extends ProxyVfs {
	constructor(public base:VfsFile) { super(); }
	protected convert(path:string):VfsFile { return this.base.access(path); }
}

export class LocalVfs extends Vfs {
	private normalizePath(path:string) {
		if (require('os').platform() == 'win32') {
			return path.replace(/^\/+/, '');
		} else {
			return `/${path}`;
		}
	}
	
	write(path:string, data:Uint8Array) {
		path = this.normalizePath(path);
		//console.log('writting', path, data.length);
		require('fs').writeFileSync(path, new Buffer(data));
	}

	read(path:string):Uint8Array {
		path = this.normalizePath(path);
		//console.log('reading', path);
		return new Uint8Array(require('fs').readFileSync(path));
	}
}

export class MemoryVfs extends Vfs {
	map:StringDictionary<Uint8Array> = {};
	
	write(path:string, data:Uint8Array) {
		this.map[path] = data;
	}

	read(path:string):Uint8Array {
		//console.log('path:', path, this.map[path]);
		return this.map[path];
	}
}

export class VfsFile {
	private normalizedPath:string;
	constructor(public vfs:Vfs, public path:string) {
		this.normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
	}
	private static combinePaths(...paths:string[]) {
		let out:string[] = [];
		for (let path of paths) {
			for (let chunk of path.split('/')) {
				switch (chunk) {
					case '': if (out.length == 0) out.push(''); break;
					case '.': break;
					case '..': out.pop(); break;
					default: out.push(chunk); break;
				}
			}
		}
		return out.join('/');
	}
	createVfs() { return new AccessVfs(this); }
	access(path:string) {
		return new VfsFile(this.vfs, VfsFile.combinePaths(this.normalizedPath, path));
	}
	write(data:Uint8Array) { return this.vfs.write(this.normalizedPath, data); }
	read():Uint8Array { return this.vfs.read(this.normalizedPath); }
	readString():string { return utils.Utf8Encoder.decode(this.read()); }
}

export const local:VfsFile = new LocalVfs().root;
export function cwd():VfsFile {
	return local.access(process.cwd()).createVfs().root;
}

export function memory(map:StringDictionary<string>):VfsFile {
	let vfs = new MemoryVfs();
	for (let key in map) {
		let value = map[key];
		vfs.write(key, utils.Utf8Encoder.encode(value));
	}
	return vfs.root;
}

export function memoryFile(text:string, name:string = 'file'):VfsFile {
	let map:StringDictionary<string> = {};
	map[name] = text;
	return memory(map).access(name);
}