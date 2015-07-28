/// <reference path="./defs.d.ts" />

import ir = require('./ir');
import utils = require('./utils');
import syntax = require('./syntax');
import { E, N, ErrorInfo } from './grammar';
import { classNameOf } from './utils';
import { Resolver, LocalResolver } from './ir';

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
	
	private error(e:E, msg:string) {
		this.result.errors.push(new ErrorInfo(e, msg));
	}

	private warning(e:E, msg:string) {
		this.result.warnings.push(new ErrorInfo(e, msg));
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
			this.method = this.clazz.createMethod('main', ir.Types.Void, ir.IrModifiers.STATIC_PUBLIC);
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
	
	expr(e:N, resolver:LocalResolver):ir.Expression {
		const b = this.b;
		if (e == null) return null;
		if (e instanceof Array) throw new Error('expr Trying to handle an array');
		if (e._text == '') return null;
		
		if (e instanceof syntax.Expr) {
			return this.expr(e.it, resolver);
		} else if (e instanceof syntax.Expr1) {
			return this.expr(e.it, resolver);
		} else if (e instanceof syntax.BinaryOpList) {
			let operators = e.operatorsRaw.map(e => e.op);
			let expressions = e.expressionsRaw.map(child => this.expr(child, resolver));
			return b.binops(operators, expressions);
		} else if (e instanceof syntax.Expr2) {
			var out = this.expr(e.left, resolver);
			for (let _part of e.parts) {
				let part = _part.item;
				if (part instanceof syntax.AccessCall) {
					out = b.call(out, part.exprs.map(arg => this.expr(arg, resolver)), ir.Types.getReturnType(out.type));
				} else if (part instanceof syntax.AccessField) {
					let member = ir.Types.access(out.type, part.id.text);
					if (member == null) {
						console.warn(`Can't find member ${part.id.text}`);
						out = b.unknown();
					} else {
						out = b.access(out, member);
					}
				} else if (part instanceof syntax.AccessArray) {
					out = b.arrayAccess(out, this.expr(part.expr, resolver));
				} else if (part._text == '--') {
					out = b.unopPost(out, '--');
				} else {
					e._element.root.dump();
					throw new Error(`Unhandled expr-part ${part._nodeType} : '${part._text}'`);
				}
			}
			return out;
		} else if (e instanceof syntax.Id) {
			return this.resolve(e.text, resolver);
		} else if (e instanceof syntax.Int) {
			return b.int(e.value);
		} else if (e instanceof syntax.Literal) {
			return this.expr(e.item, resolver);
		}
		
		e._element.root.dump();
		throw new Error(`Unhandled expr ${e._nodeType} : '${e._text}'`);
	}
	
	stm(e:N, resolver:LocalResolver):ir.Statement {
		let b = this.b;

		if (e == null) return null;
		if (e instanceof Array) throw new Error('stm Trying to handle an array');
		if (e._text == '') return null;
		
		if (e instanceof syntax.Stm) return this.stmStm(e, resolver);
		if (e instanceof syntax.If) return this.stmIf(e, resolver);
		if (e instanceof syntax.While) return this.stmWhile(e, resolver);
		if (e instanceof syntax.Return) return this.stmReturn(e, resolver);
		if (e instanceof syntax.ExprStm) return b.exprstm(this.expr(e.expr, resolver));
		if (e instanceof syntax.Vars) return this.stmVars(e, resolver);
		if (e instanceof syntax.ClassType) return this.stmClass(e, resolver);
		if (e instanceof syntax.For) return this.stmFor(e, resolver);
		if (e instanceof syntax.VarDecl) {
			let lazy = (e.init.initType._text == '=>');
			let initExpr = e.init.expr;
			let initValue = this.expr(initExpr, resolver);
			let local = this.method.createLocal(e.name.text, initExpr ? initValue.type : ir.Types.holder());
			resolver.add(local);
			return b.exprstm(b.assign(b.local(local), initValue));
		} else if (e instanceof syntax.Stms) {
			let scopeResolver = resolver.child();
			return b.stms(e.stms.map(c => this.stm(c, scopeResolver)));
		} else if (e instanceof syntax.StmsBlock) {
			return this.stmBlock(e, resolver);
		} else if (e instanceof syntax.Function) {
			this.ensureClass();
			let methodName = e.name._text;
			let method = this.clazz.createMethod(methodName, ir.Types.holder(), ir.IrModifiers.STATIC_PUBLIC)
			method.bodyNode = e.body;
			for (let arg of e.args.args) {
				method.addParam(arg.name.text, ir.Types.Int);
			}
			this.completeMethods.push(method);
			return b.stms([]);
		} else if (e instanceof syntax.FunctionBody1) {
			return b.ret(this.expr(e.expr, resolver));
		}
		
		//console.log(e);
		if (e._element) e._element.root.dump();
		throw new Error(`Unhandled stm ${e._nodeType} : '${e._text}'`);
	}
	
	stmReturn(e:syntax.Return, resolver:LocalResolver) {
		return this.b.ret(this.expr(e.expr, resolver));
	}
	
	stmVars(e:syntax.Vars, resolver:LocalResolver) {
		return this.b.stms(e.vars.map(v => this.stm(v, resolver)));
	}
	
	stmStm(e:syntax.Stm, resolver:LocalResolver) {
		return this.stm(e.it, resolver);
	}
	
	stmIf(e:syntax.If, resolver:LocalResolver) {
		return this.b._if(this.expr(e.expr, resolver), this.stm(e.codeTrue, resolver), this.stm(e._else ? e._else.codeFalse : null, resolver));
	}

	stmFor(e:syntax.For, resolver:LocalResolver) {
		let iterExpr = this.expr(e.expr, resolver);
		let elementType = iterExpr.type.arrayElement;
		let iterName = e.id.text;
		let scopeResolver = resolver.child();
		let iterVar = this.method.createLocal(iterName, elementType);
		scopeResolver.add(iterVar);
		return this.b._for(iterVar, iterExpr, this.stm(e.body, scopeResolver));
	}

	stmWhile(e:syntax.While, resolver:LocalResolver) {
		return this.b._while(this.expr(e.expr, resolver), this.stm(e.code, resolver));
	}
	
	stmBlock(e:syntax.StmsBlock, resolver:LocalResolver) {
		//let scopeResolver = resolver.child();
		//return this.b.stms(e.stms.map(c => this.stm(c, scopeResolver)));

		let scopeResolver = resolver.child();
		return this.stm(e.stms, scopeResolver);
	}
	
	stmClass(e:syntax.ClassType, resolver:LocalResolver):any {
		var name = e.name.id._text;
		var oldClass = this.clazz;
		this.clazz = this.mod.createClass(name);
		var constructorCode = this.stm(e.body, new LocalResolver(null));
		this.clazz = oldClass;
		return null;
	}
	
	private completeMethods:ir.IrMethod[] = [];
	doCompleteMethods() {
		let b = this.b;
		let oldMethod = this.method;
		while (this.completeMethods.length > 0) {
			let method = this.completeMethods.shift();
			this.method = method;
			method.body = b.stms([this.stm(method.bodyNode, method.resolver)]);
			method.finalize();
		}
		this.method = oldMethod;
	}
	
	_compile(node:N) {
		this.ensureMethod();
		var s = this.stm(node, this.method.resolver);
		this.method.body.add(s);
	}
	
	compile(node:N) {
		this._compile(node);
		this.doCompleteMethods();
	}
}

export class CompileResult {
	public errors:ErrorInfo[] = [];
	public warnings:ErrorInfo[] = [];
	public module:ir.IrModule;
}

export function compile(node:N):CompileResult {
	let compiler = new Compiler();
	compiler.compile(node);
	return compiler.result;
}