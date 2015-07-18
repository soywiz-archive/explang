/// <reference path="./defs.d.ts" />
		
declare class DataView {
	buffer:ArrayBuffer;
	constructor(ab:ArrayBuffer);
	byteLength: number;
	getUint8(offset: number): number;
	setUint8(offset: number, value: number): void;
	setUint16(offset: number, value: number, little:boolean): void;
	setUint32(offset: number, value: number, little:boolean): void;
}

declare function unescape(s:string):string;
declare function escape(s:string):string;

export class Utf8Encoder {
	static encode(text:string):Uint8Array {
		var str = this.encode_utf8(text);
		var out = new Uint8Array(str.length);
		for (var n = 0; n < str.length; n++) out[n] = str.charCodeAt(n);
		return out;
	}
	
	static decode(data:Uint8Array):string {
		return this.decode_utf8(String.fromCharCode.apply(null, data));
	}
	
	private static encode_utf8(s:string) {
		return unescape(encodeURIComponent(s));
	}

	private static decode_utf8(s:string) {
	  return decodeURIComponent(escape(s));
	}
}

export function classNameOf(v:any):string {
	let res = typeof v;
	if (res == 'object') {
		res = (<any>v.constructor).name;
	}
	return res;
}

export class Writer {
	buffer = new DataView(new ArrayBuffer(64));
	position = 0;
	length = 0;
	
	private ensure(size:number) {
		this.length = Math.max(this.position + size, this.length);
		while (this.length > this.buffer.byteLength) {
			var oldsize = this.buffer.byteLength;
			var nbuffer = new DataView(new ArrayBuffer(oldsize * 2));;
			// slow
			for (var n = 0; n < oldsize; n++) nbuffer.setUint8(n, this.buffer.getUint8(n));
			this.buffer = nbuffer;
		}
	}
	
	u8(value:number) { this.ensure(1); this.buffer.setUint8(this.position, value); this.position += 1; return this; }
	u16(value:number) { this.ensure(2); this.buffer.setUint16(this.position, value, false); this.position += 2; return this; }
	u32(value:number) { this.ensure(4); this.buffer.setUint32(this.position, value, false); this.position += 4; return this; }
	data(value:Uint8Array) {
		for (var n = 0; n < value.length; n++) {
			this.u8(value[n]);
		}
	}
	toUint8Array():Uint8Array {
		return new Uint8Array(this.buffer.buffer, 0, this.length);
	}
}

export class IndentWriter {
	private chunks:string[] = [];
	
	write(str:string) {
		this.chunks.push(str);
		return this;
	}
	
	action(v:any) {
		return this;
	}

	ln() {
		this.write('\n');
		return this;
	}

	writeln(str:string) {
		this.write(str);
		this.ln();
		return this;
	}

	in() {
	}

	out() {
	}
	
	indent(callback: () => void) {
		callback();	
		return this;
	}
	
	toString() {
		return this.chunks.join('');
	}
}

export class IndentedString {
	static EMPTY = new IndentedString([]);
	
	constructor(private chunks:any[]) {	
	}
	
	indent(cb: () => any) {
		return new IndentedString([this, 0, cb(), 1]);
	}
	
	with(value:any) {
		return new IndentedString([this, value]);
	}
	
	private static write(item:any, iw:IndentWriter):IndentWriter {
		if (item instanceof IndentedString) {
			for (let chunk of item.chunks) this.write(chunk, iw);
		} else {
			switch (item) {
				case 0: iw.in(); break;
				case 1: iw.out(); break;
				default: iw.write('' + item); break;
			}
		}
		return iw;
	}
	
	toString() {
		return IndentedString.write(this, new IndentWriter()).toString();
	}
}

export class Map2<K1, K2, V> {
	private data = new Map<K1, Map<K2, V>>();
	
	set(k1:K1, k2:K2, v:V) {
		if (!this.data.has(k1)) this.data.set(k1, new Map<K2, V>());
		this.data.get(k1).set(k2, v);
		return this;
	}
	
	has(k1:K1, k2:K2):boolean {
		var m1 = this.data.get(k1);
		if (!m1) return false;
		return m1.has(k2);
	}

	get(k1:K1, k2:K2):V {
		var m1 = this.data.get(k1);
		if (!m1) return undefined;
		return m1.get(k2);
	}
}

export class Map3<K1, K2, K3, V> {
	private data = new Map<K1, Map2<K2, K3, V>>();
	
	set(k1:K1, k2:K2, k3:K3, v:V) {
		if (!this.data.has(k1)) this.data.set(k1, new Map2<K2, K3, V>());
		this.data.get(k1).set(k2, k3, v);
		return this;
	}
	
	has(k1:K1, k2:K2, k3:K3):boolean {
		var m1 = this.data.get(k1);
		if (!m1) return false;
		return m1.has(k2, k3);
	}

	get(k1:K1, k2:K2, k3:K3):V {
		var m1 = this.data.get(k1);
		if (!m1) return undefined;
		return m1.get(k2, k3);
	}
}