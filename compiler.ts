import ir = require('./ir_ast');
import lang = require('./lang_ast');

var b = new ir.NodeBuilder();

class Compiler {
	private mod = new ir.IrModule();
	private clazz:ir.IrClass;
	private method:ir.IrMethod;
	public result = new CompileResult();

	constructor() {
		this.result.module = this.mod;
	}
	
	private error(e:lang.PsiElement, msg:string) {
		this.result.errors.push(new Error(e, msg));
	}

	private warning(e:lang.PsiElement, msg:string) {
		this.result.warnings.push(new Error(e, msg));
	}
	
	private ensureClass() {
		if (this.clazz == null) {
			this.clazz = this.mod.createClass('Main');
		}
	}

	private ensureMethod() {
		this.ensureClass();
		if (this.method == null) {
			this.method = this.clazz.createMethod('main', b.ret());
		}
	}
	
	compnode(e:lang.PsiElement):ir.Node {
		if (e == null) return null;
		if (e.text == '') return null;
		
		if (e instanceof lang.If) {
			return b._if(this.compnode(e.expr), this.compnode(e.codeTrue), this.compnode(e.codeFalse));
		}
		
		if (e instanceof lang.Return) {
			return b.ret(this.compnode(e.expr));
		}
		
		throw `Unhandled ${e.type} : '${e.text}'`;
	}
	
	compile(e:lang.PsiElement) {
		if (e == null) return;
		
		if (e instanceof lang.Class) {
			var name = e.idwg.text;
			this.clazz = this.mod.createClass(name);
			return;
		}
		
		if (e instanceof lang.Stms) {
			for (let c of e.elements) this.compile(c);
			return;
		}


		//if (!this.clazz) this.error(e, `Expecting a class but found ${e.type}`);	
		
		this.ensureMethod();
		this.method.body = this.compnode(e);
	}
}

export class Error {
	constructor(public e:lang.PsiElement, public msg:string) { }
	
	toString() { return `ERROR:${this.e.range}:${this.msg}`; }
}

export class CompileResult {
	public errors:Error[] = [];
	public warnings:Error[] = [];
	public module:ir.IrModule;
}

export function compile(e:lang.PsiElement):CompileResult {
	let compiler = new Compiler();
	compiler.compile(e);
	return compiler.result;
}