
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
	
	indent(callback: () => void) {
		callback();	
		return this;
	}
	
	toString() {
		return this.chunks.join('');
	}
}