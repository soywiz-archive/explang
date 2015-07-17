/// <reference path="./defs.d.ts" />

export class Writer {
	i8(value:number) { throw "Not implemented"; }
	i16(value:number) { throw "Not implemented"; }
	i32(value:number) { throw "Not implemented"; }
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