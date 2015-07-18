/// <reference path="./defs.d.ts" />

import ir = require('./ir_ast');
import utils = require('./utils');
import lang = require('./lang_ast');
import { ResolverItem, Resolver, LocalResolver } from './ir_ast';

class Compiler {
	private mod = new ir.IrModule();
	private b:ir.NodeBuilder;
	private clazz:ir.IrClass;
	private method:ir.IrMethod;
	public result = new CompileResult();

	constructor() {
		this.result.module = this.mod;
		this.b = new ir.NodeBuilder(this.mod);
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
		const b = this.b;
		this.ensureClass();
		if (this.method == null) {
			this.method = this.clazz.createMethod('main', ir.Types.Void, ir.IrModifiers.STATIC_PUBLIC, b.stms([]));
			this.method.addParam('argv', ir.Types.array(ir.Types.String));
		}
	}
	
	private resolve(id:string, resolver:Resolver):ir.Expression {
		const b = this.b;
		if (id == 'this') {
			return b._this(this.clazz.type);
		}
		var item = resolver.get(id);
		if (item instanceof ir.IrLocal) return b.local(item);
		if (item instanceof ir.IrParameter) return b.arg(item);
		if (item instanceof ir.UnknownItem) return b.unknown();
		if (item instanceof ir.IrMethod) return b.member(item);
		throw "Unknown resolution type " + utils.classNameOf(item);
	}
	
	expr(e:lang.PsiElement, resolver:LocalResolver):ir.Expression {
		const b = this.b;
		if (e == null) return null;
		if (e.text == '') return null;
		
		if (e instanceof lang.BinaryOpList) {
			return b.binops(e.operatorsRaw.map(e => e.text), e.expressions.map(child => this.expr(child, resolver)));
		} else if (e instanceof lang.CallOrArrayAccess) {
			var out = this.expr(e.left, resolver);
			for (let part of e.parts) {
				if (part instanceof lang.AccessCall) {
					out = b.call(out, part.args.map(arg => this.expr(arg, resolver)), ir.Types.getReturnType(out.type));
				} else if (part instanceof lang.AccessField) {
					let member = ir.Types.access(out.type, part.id.text);
					if (member == null) {
						console.warn(`Can't find member ${part.id.text}`);
						out = b.unknown();
					} else {
						out = b.access(out, member);
					}
				} else if (part instanceof lang.AccessArray) {
					out = b.arrayAccess(out, this.expr(part.expr, resolver));
				} else if (part.text == '--') {
					out = b.unopPost(out, '--');
				} else {
					e.root.dump();
					throw `Unhandled expr-part ${part.type} : '${part.text}'`;
				}
			}
			return out;
		} else if (e instanceof lang.Id) {
			return this.resolve(e.text, resolver);
		} else if (e instanceof lang.Int) {
			return b.int(parseInt(e.text));
		}
		
		e.root.dump();
		throw `Unhandled expr ${e.type} : '${e.text}'`;
	}
	
	stm(e:lang.PsiElement, resolver:LocalResolver):ir.Statement {
		let b = this.b;

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
			let initExpr = e.initExpr;
			let initValue = this.expr(initExpr, resolver);
			let local = this.method.createLocal(e.name.text, initExpr ? initValue.type : ir.Types.Unknown);
			resolver.add(local);
			return b.exprstm(b.assign(b.local(local), initValue));
		} else if (e instanceof lang.Stms) {
			let scopeResolver = resolver.child();
			return b.stms(e.stms2.map(c => this.stm(c, scopeResolver)));
		} else if (e instanceof lang.Function) {
			this.ensureClass();
			let methodName = e.id_wg.text;
			let method = this.clazz.createMethod(methodName, ir.Types.Void, ir.IrModifiers.STATIC_PUBLIC, b.stms([]))
			method.bodyNode = e.body;
			for (let arg of e.fargs) {
				method.addParam(arg.name.text, ir.Types.Int);
			}
			this.completeMethods.push(method);
			return b.stms([]);
		} else if (e instanceof lang.FunctionExpBody) {
			return b.ret(this.expr(e.expr, resolver));
		}
		
		e.root.dump();
		throw `Unhandled stm ${e.type} : '${e.text}'`;
	}
	
	private completeMethods:ir.IrMethod[] = [];
	doCompleteMethods() {
		let b = this.b;
		let oldMethod = this.method;
		while (this.completeMethods.length > 0) {
			let method = this.completeMethods.shift();
			this.method = method;
			method.body = b.stms([this.stm(method.bodyNode, method.resolver)]);
		}
		this.method = oldMethod;
	}
	
	_compile(e:lang.PsiElement) {
		let b = this.b;

		if (e == null) return;
		
		if (e instanceof lang.Class) {
			var name = e.idwg.text;
			this.clazz = this.mod.createClass(name);
			return;
		}
		
		if (e instanceof lang.Stms) {
			for (let c of e.elements) this._compile(c);
			return;
		}


		//if (!this.clazz) this.error(e, `Expecting a class but found ${e.type}`);	
		
		this.ensureMethod();
		if (!this.method.body) this.method.body = b.stms([]);
		this.method.body.add(this.stm(e, this.method.resolver));
	}
	
	compile(e:lang.PsiElement) {
		this._compile(e);
		this.doCompleteMethods();
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