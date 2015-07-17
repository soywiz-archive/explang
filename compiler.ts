import ir = require('./ir_ast');
import lang = require('./lang_ast');
import { ResolverItem, Resolver, LocalResolver } from './ir_ast';
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
			this.method = this.clazz.createMethod('main', true, b.stms([]));
		}
	}
	
	expr(e:lang.PsiElement, resolver:LocalResolver):ir.Expression {
		if (e == null) return null;
		if (e.text == '') return null;
		
		if (e instanceof lang.BinaryOpList) {
			return b.binops(e.operatorsRaw.map(e => e.text), e.expressions.map(child => this.expr(child, resolver)));
		} else if (e instanceof lang.CallOrArrayAccess) {
			var out = this.expr(e.left, resolver);
			for (let part of e.parts) {
				if (part instanceof lang.AccessCall) {
					out = b.call(out, part.args.map(arg => this.expr(arg, resolver)), ir.Types.getReturnType(out.type));
				} else if (part.text == '--') {
					out = b.unopPost(out, '--');
				} else {
					e.root.dump();
					throw `Unhandled expr-part ${part.type} : '${part.text}'`;
				}
			}
			return out;
		} else if (e instanceof lang.Id) {
			return b.id(e.text, resolver.get(e.text).type);
		} else if (e instanceof lang.Int) {
			return b.int(parseInt(e.text));
		}
		
		e.root.dump();
		throw `Unhandled expr ${e.type} : '${e.text}'`;
	}
	
	stm(e:lang.PsiElement, resolver:LocalResolver):ir.Statement {
		if (e == null) return null;
		if (e.text == '') return null;
		
		if (e instanceof lang.If) {
			return b._if(this.expr(e.expr, resolver), this.stm(e.codeTrue, resolver), this.stm(e.codeFalse, resolver));
		} else if (e instanceof lang.While) {
			return b._while(this.expr(e.expr, resolver), this.stm(e.code, resolver));
		} else if (e instanceof lang.Return) {
			return b.ret(this.expr(e.expr, resolver));
		} else if (e instanceof lang.ExpressionStm) {
			return b.exprstm(this.expr(e.expression, resolver));
		} else if (e instanceof lang.VarDecls) {
			return b.stms(e.vars.map(v => this.stm(v, resolver)));
		} else if (e instanceof lang.VarDecl) {
			var initExpr = e.initExpr;
			var initValue = this.expr(initExpr, resolver);
			var local = this.method.createLocal(e.name.text, initExpr ? initValue.type : ir.Types.Unknown);
			resolver.add(local);
			return b.exprstm(b.assign(b.id(local.name, initValue.type), initValue));
		} else if (e instanceof lang.Stms) {
			var scopeResolver = new LocalResolver(resolver);
			return b.stms(e.stms2.map(c => this.stm(c, scopeResolver)));
		}
		
		e.root.dump();
		throw `Unhandled stm ${e.type} : '${e.text}'`;
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
		if (!this.method.body) this.method.body = b.stms([]);
		this.method.body.add(this.stm(e, this.method.resolver));
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