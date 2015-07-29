/// <reference path="./defs.d.ts" />

import ir = require('./ir');
import utils = require('./utils');
import syntax = require('./syntax');
import { Types } from './ir';
import { E, N, ErrorInfo, ErrorList } from './grammar';
import { classNameOf, trace } from './utils';
import { Resolver, LocalResolver } from './ir';

class Compiler {
	private module = new ir.IrModule();
	private b:ir.NodeBuilder;
	private _clazz:ir.IrClass;
	private _method:ir.IrMethod;
	public result = new CompileResult();

	constructor() {
		this.result.module = this.module;
		this.b = new ir.NodeBuilder(this.module);
	}
	
	private error(e:E, msg:string) {
		this.result.errors.add(new ErrorInfo(e, msg));
	}

	private warning(e:E, msg:string) {
		this.result.errors.add(new ErrorInfo(e, msg));
	}
	
	private _ensureClass() {
		if (this._clazz == null) {
			this._clazz = this.module.createClass('Main');
		}
	}
	
	private get clazz() {
		this._ensureClass();
		return this._clazz;
	}

	private _ensureMethod() {
		const b = this.b;
		if (this._method == null) {
			this._method = this.clazz.createMethod('main', ir.Types.Dynamic, ir.IrModifiers.STATIC_PUBLIC);
			this._method.addParam('argv', ir.Types.array(ir.Types.String));
		}
	}
	
	private get method() {
		this._ensureMethod();
		return this._method;
	}
	
	private resolve(psi:E, id:string, resolver:Resolver):ir.Expression {
		const b = this.b;
		if (id == 'this') {
			return b._this(psi, this.clazz.type);
		}
		var item = resolver.get(id);
		if (item instanceof ir.IrLocal) return b.local(psi, item);
		if (item instanceof ir.IrParameter) return b.arg(psi, item);
		if (item instanceof ir.UnknownItem) return b.unknown(psi);
		if (item instanceof ir.IrMethod) return b.member(psi, item);
		if (item instanceof ir.IrClass) return b.class(psi, item);
		if (item instanceof ir.IrIntrinsic) return b.intrinsic(psi, item);
		throw "Unknown resolution type " + utils.classNameOf(item);
	}
	
	expr(e:N, resolver:LocalResolver):ir.Expression {
		const b = this.b;
		if (e == null) return null;
		if (e instanceof Array) throw new Error('expr Trying to handle an array');
		if (e._text == '') return null;
		let psi = e._element;
		
		if (e instanceof syntax.Expr) {
			return this.expr(e.it, resolver);
		} else if (e instanceof syntax.Expr1) {
			return this.expr(e.it, resolver);
		} else if (e instanceof syntax.BinaryOpList) {
			let operators = e.operatorsRaw.map(e => e.op);
			let expressions = e.expressionsRaw.map(child => this.expr(child, resolver));
			return b.binops(psi, operators, expressions);
		} else if (e instanceof syntax.Expr2) {
			var out = this.expr(e.left, resolver);
			for (let _part of e.parts) {
				let part = _part.item;
				if (part instanceof syntax.AccessCall) {
					out = b.call(psi, out, part.exprs.map(arg => this.expr(arg, resolver)), ir.Types.getReturnType(out.type));
				} else if (part instanceof syntax.AccessField) {
					let member = ir.Types.access(out.type, part.id.text);
					if (member == null) {
						console.warn(`Can't find member ${part.id.text}`);
						out = b.unknown(psi);
					} else {
						out = b.access(psi, out, member);
					}
				} else if (part instanceof syntax.AccessArray) {
					out = b.arrayAccess(psi, out, this.expr(part.expr, resolver));
				} else if (part._text == '--') {
					out = b.unopPost(psi, out, '--');
				} else {
					e._element.root.dump();
					throw new Error(`Unhandled expr-part ${part._nodeType} : '${part._text}'`);
				}
			}
			return out;
		} else if (e instanceof syntax.Id) {
			return this.resolve(psi, e.text, resolver);
		} else if (e instanceof syntax.Literal) {
			return this.expr(e.item, resolver);
		} else if (e instanceof syntax.Int) {
			return b.int(psi, e.value);
		} else if (e instanceof syntax.String1) {
			return b.string(psi, e.escapedText);
		}
		
		e._element.root.dump();
		throw new Error(`Unhandled expr ${e._nodeType} : '${e._text}'`);
	}
	
	stm(e:N, resolver:LocalResolver):ir.Statement {
		let b = this.b;

		if (e == null) return null;
		if (e instanceof Array) throw new Error('stm Trying to handle an array');
		if (e._text == '') return null;
		let psi = e._element;
		
		if (e instanceof syntax.Stm) return this.stmStm(e, resolver);
		if (e instanceof syntax.If) return this.stmIf(e, resolver);
		if (e instanceof syntax.StaticIf) return this.stmStaticIf(e, resolver);
		if (e instanceof syntax.StaticFail) return this.stmStaticFail(e, resolver);
		if (e instanceof syntax.While) return this.stmWhile(e, resolver);
		if (e instanceof syntax.Return) return this.stmReturn(e, resolver);
		if (e instanceof syntax.ExprStm) return b.exprstm(psi, this.expr(e.expr, resolver));
		if (e instanceof syntax.Vars) return this.stmVars(e, resolver);
		if (e instanceof syntax.ClassType) return this.stmClass(e, resolver);
		if (e instanceof syntax.For) return this.stmFor(e, resolver);
		if (e instanceof syntax.VarDecl) return this.stmVarDecl(e, resolver);
		if (e instanceof syntax.Stms) {
			let scopeResolver = resolver.child();
			return b.stms(psi, e.stms.map(c => this.stm(c, scopeResolver)));
		} else if (e instanceof syntax.StmsBlock) {
			return this.stmBlock(e, resolver);
		} else if (e instanceof syntax.Function) {
			let methodName = e.name._text;
			let type = e.rettype ? ir.Types.fromString(e.rettype.decl._text, resolver) : ir.Types.holder();
			let method = this.clazz.createMethod(methodName, type, ir.IrModifiers.STATIC_PUBLIC)
			method.bodyNode = e.body;
			for (let arg of e.args.args) {
				let type = this.getType(arg.typetag, resolver);
				method.addParam(arg.name.text, type);
			}
			this.completeMethods.push(method);
			return b.stms(psi, []);
		} else if (e instanceof syntax.FunctionBody1) {
			return b.ret(psi, this.expr(e.expr, resolver));
		}
		
		//console.log(e);
		if (e._element) e._element.root.dump();
		throw new Error(`compiler : Unhandled stm ${e._nodeType} : '${e._text}'`);
	}
	
	stmVarDecl(e:syntax.VarDecl, resolver:LocalResolver) {
		let b = this.b;
		let psi = e._element;
		let lazy = (e.init.initType._text == '=>');
		let initExpr = e.init.expr;
		let initValue = this.expr(initExpr, resolver);
		let local = this.method.createLocal(e.name.text, initExpr ? initValue.type : ir.Types.holder());
		resolver.add(local);
		return b.exprstm(psi, b.assign(psi, b.local(psi, local), initValue));
	}

	stmReturn(e:syntax.Return, resolver:LocalResolver) {
		let returnType = this.method.returnType;
		let expr = this.expr(e.expr, resolver);
		let psi = e._element;
		let thisReturnType = expr ? expr.type : ir.Types.Void;
		return this.b.ret(psi, expr);
	}
	
	stmVars(e:syntax.Vars, resolver:LocalResolver) {
		let psi = e._element;
		return this.b.stms(psi, e.vars.map(v => this.stm(v, resolver)));
	}
	
	stmStm(e:syntax.Stm, resolver:LocalResolver) {
		return this.stm(e.it, resolver);
	}

	stmStaticIf(e:syntax.StaticIf, resolver:LocalResolver) {
		let psi = e._element;
		return this.b.staticif(psi, e.id.text, this.stm(e.codeTrue, resolver), this.stm(e._else ? e._else.codeFalse : null, resolver));
	}
	
	stmStaticFail(e:syntax.StaticFail, resolver:LocalResolver) {
		let psi = e._element;
		return this.b.staticfail(psi, e.str.escapedText);
	}
	
	stmIf(e:syntax.If, resolver:LocalResolver) {
		let psi = e._element;
		return this.b._if(psi, this.expr(e.expr, resolver), this.stm(e.codeTrue, resolver), this.stm(e._else ? e._else.codeFalse : null, resolver));
	}

	stmFor(e:syntax.For, resolver:LocalResolver) {
		let iterExpr = this.expr(e.expr, resolver);
		let elementType = iterExpr.type.arrayElement;
		let iterName = e.id.text;
		let scopeResolver = resolver.child();
		let iterVar = this.method.createLocal(iterName, elementType);
		let psi = e._element;
		scopeResolver.add(iterVar);
		return this.b._for(psi, iterVar, iterExpr, this.stm(e.body, scopeResolver));
	}

	stmWhile(e:syntax.While, resolver:LocalResolver) {
		let psi = e._element;
		return this.b._while(psi, this.expr(e.expr, resolver), this.stm(e.code, resolver));
	}
	
	stmBlock(e:syntax.StmsBlock, resolver:LocalResolver) {
		//let scopeResolver = resolver.child();
		//return this.b.stms(e.stms.map(c => this.stm(c, scopeResolver)));

		let scopeResolver = resolver.child();
		return this.stm(e.stms, scopeResolver);
	}
	
	typeMembers(clazz:ir.IrClass, e:syntax.MemberDecls, resolver:LocalResolver) {
		for (let member of e.members) {
			this.typeMember(clazz, member, resolver);
		}
	}
	
	getType(typetag:syntax.TypeTag, resolver:LocalResolver):ir.Type {
		if (typetag == null) return Types.Unknown;
		let type = Types.fromString(typetag.decl._text, resolver, true);
		if (type != null) return type;
		let clazz = resolver.get(typetag.decl._text);
		return Types.classType(<ir.IrClass>clazz);
	}
	
	typeMember(clazz:ir.IrClass, e:N, resolver:LocalResolver):any {
		if (e instanceof syntax.MemberDecl) return this.typeMember(clazz, e.it, resolver);
		if (e instanceof syntax.FieldDecl) {
			let field = clazz.createField(e.name.text, this.getType(e.optTypeTag, resolver), ir.IrModifiers.PUBLIC);
			field.init = this.expr(e.init, resolver);
			return;
		}
		
		throw new Error(`Unhandled typeMember ${e}`);
		return null;
	}
	
	stmClass(e:syntax.ClassType, resolver:LocalResolver):any {
		var name = e.name.id._text;
		var oldClass = this.clazz;
		let clazz = this.module.createClass(name);
		this.clazz = clazz;
		this.typeMembers(clazz, e.members, resolver);
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
			let body = this.stm(method.bodyNode, method.resolver);
			method.body = b.stms(body.psi, [body]);
			method.finalize();
		}
		this.method = oldMethod;
	}
	
	_compile(node:N) {
		var s = this.stm(node, this.method.resolver);
		this.method.body.add(s);
	}
	
	compile(node:N) {
		this._compile(node);
		this.doCompleteMethods();
	}
}

export class CompileResult {
	public errors = new ErrorList();
	public module:ir.IrModule;
}

export function compile(node:N):CompileResult {
	let compiler = new Compiler();
	compiler.compile(node);
	let result = compiler.result;
	let analyzeResults = ir.Analyzer.analyzeModule(result.module, result.errors);
	return result;
}