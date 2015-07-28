/// <reference path="./defs.d.ts" />

import { Map2, Map3, UserData, NameAlloc, classNameOf, trace } from './utils';
import { E, ErrorInfo, ErrorList } from './grammar';

export class IrModule {
	public classes:IrClass[] = [];
	public operators = new IrOperators();
	
	constructor() {
		for (let op of ['+', '-', '*', '%', '**', '<=>',
			'+=']) {
			this.operators.addBinop(new IrOperator(this, op, Types.Int, Types.Int, Types.Int, null));
		}
		this.operators.addBinop(new IrOperator(this, '...', Types.Int, Types.Int, Types.iterable(Types.Int), null));
	}

	createClass(name:string) {
		return new IrClass(name, this);
	}
}

export class IrOperators {
	private binary = new Map3<String, Type, Type, IrOperator>();
	private unaryPre = new Map2<String, Type, IrOperator>();
	private unaryPost = new Map2<String, Type, IrOperator>();
	
	constructor() { }
	
	addBinop(op:IrOperator) {
		this.binary.set(op.symbol, op.left, op.right, op);
	}
	
	getBinop(op:string, left:Type, right:Type):IrOperator {
		return this.binary.get(op, left, right);
	}

	getUnaryPre(op:string, right:Type):IrOperator {
		return this.unaryPre.get(op, right);
	}

	getUnaryPost(op:string, left:Type):IrOperator {
		return this.unaryPost.get(op, left);
	}
}

export class IrOperator {
	constructor(public module:IrModule, public symbol:string, public left:Type, public right:Type, public result:Type, public method:IrMethod) {
		//module.operators.
	}
}

export class IrMember {
	public constructor(public name:string, public containingClass:IrClass) {
	}
	
	get type():Type {
		return Types.Invalid;
	}
	
	get module() { return this.containingClass.module; }
}

export class IrLocal {
	constructor(public originalName:string, public allocName:string, public type:Type, public method:IrMethod) {
	}
	
	get name() { return this.originalName; }
}

export class IrParameter implements ResolverItem {
	constructor(public params:IrParameters, public index:number, public name:string, public type:Type, public init?:Expression) {
	}
}

export class IrParameters {
	public params:IrParameter[] = [];
	
	constructor(public method:IrMethod) { }
	
	addParam(name:string, type:Type, init?:Expression) {
		let param = new IrParameter(this, this.params.length, name, type, init);
		this.params.push(param);
		return param;
	}
}

export class IrMethod extends IrMember {
	locals: IrLocal[] = [];
	params: IrParameters = new IrParameters(this);
	bodyNode: any;
	resolver: LocalResolver;
	body:Statements = new Statements(null, []);
	names = new NameAlloc();
	
	get simpleString() { return `${this.containingClass.simpleString}.${this.name}`; }
	toString() { return `IrMethod(${this.simpleString})`; }

	
	public constructor(public name:string, public returnType:Type, public modifiers:IrModifiers, public containingClass:IrClass) {
		super(name, containingClass);
		this.resolver = new LocalResolver(new MethodResolver(this));
	}
	
	get type() {
		//let result = Analyzer.analyze(this.body);
		//this.retval.canAssign(result.returnType);
		return Types.func(this.returnType, this.params.params.map(p => p.type));
	}
	
	get fqname() { return this.containingClass.name + '::' + this.name; }
	
	addParam(name:string, type:Type, init?:Expression) {
		return this.params.addParam(name, type, init);
	}
	
	createLocal(name:string, type:Type) {
		let local = new IrLocal(name, this.names.alloc(name), type, this);
		this.locals.push(local);
		return local;
	}
	
	finalize() {
		//let result = Analyzer.analyze(this.body);
		//this.returnType.canAssign(result.returnType);
	}
}

export class IrField extends IrMember {
	public init:Expression = null;
	
	public constructor(public name:string, public type:Type, public modifiers:IrModifiers, public containingClass:IrClass) {
		super(name, containingClass);
	}
}

export class IrScope {
	
}

export enum IrModifiers {
	PUBLIC = 1 << 0,
	PRIVATE = 1 << 1,
	STATIC = 1 << 2,
	
	STATIC_PRIVATE = STATIC | PRIVATE,
	STATIC_PUBLIC = STATIC | PUBLIC,
}

export class IrClass {
	public fields:IrField[] = [];
	public methods:IrMethod[] = [];
	public members = new Map<string, IrMember>();
	public type:Type;
	
	get simpleString() { return `${this.name}`; }
	toString() { return `IrClass(${this.simpleString})`; }
	
	constructor(public name:string, public module:IrModule) {
		module.classes.push(this);
		this.type = Types.classType(this);
	}
	
	get fqname() { return this.name; }
	
	getMember(name:string) {
		return this.members.get(name);
	}
	
	createMethod(name:string, returnType:Type, modifiers:IrModifiers) {
		let method = new IrMethod(name, returnType, modifiers, this);
		this.methods.push(method);
		this.members.set(name, method);
		return method;
	}
	
	createField(name:string, type:Type, modifiers:IrModifiers) {
		let field = new IrField(name, type, modifiers, this);
		this.fields.push(field);
		this.members.set(name, field);
		return field;
	}
}

export class Type {
	toString() { return '$TYPE'; }
	get arrayElement() { return Types.getElement(this); }
	canAssign(other:Type) {
		return true;
	}
}

export class ClassType extends Type {
	constructor(public clazz:IrClass) {
		super();
	}
	toString() { return this.clazz.name; }
}

export class PrimitiveType extends Type {
	constructor(public name:string) { super(); }
	toString() { return this.name; }
}

export class ArrayType extends Type {
	public constructor(public element:Type) { super(); }
	//toString() { return `${this.element}[]`; }
	toString() { return `Array<${this.element}>`; }
}

export class FunctionType extends Type {
	public constructor(public retval:Type, public args:Type[]) { super(); }
	toString() { return '(' + this.args.join(', ') + ') => ' + this.retval; }
}

export class Generic {
	constructor(public name:string, public constraints?:any) { }
	toString() { return this.name; }
}

export class GenericType extends Type {
	public constructor(public base:Type, public generics:Generic[]) { super(); }
	toString() { return this.generics.length ? `${this.base}<${this.generics.join(', ')}>` :`${this.base}` ; }
	toSpecific(map:Map<string, Type>):SpecificType {
		return new SpecificType(this.base, this.generics.map(g => map.get(g.name)));
	}
}

export class SpecificType extends Type {
	public constructor(public base:Type, public specifics:Type[]) { super(); }
	toString() { return this.specifics.length ? `${this.base}<${this.specifics.join(', ')}>` :`${this.base}` ; }
}

export class HolderType extends Type {
	public referenced:Type = null;
	public constructor() { super(); }
	toString() {
		if (this.referenced == null) return '<Unknown>';
		return `${this.referenced}`; 
	}
	canAssign(other:Type) {
		if (this.referenced == null) this.referenced = other;
		return this.referenced.canAssign(other);
	}
}

export class Types {
	public static Void = new PrimitiveType('Void');
	public static Bool = new PrimitiveType('Bool');
	public static Int = new PrimitiveType('Int');
	public static Dynamic = new PrimitiveType('Dynamic');
	public static Long = new PrimitiveType('Long');
	public static Float = new PrimitiveType('Float');
	public static Double = new PrimitiveType('Double');
	public static String = new PrimitiveType('String');
	private static Array = new PrimitiveType('Array');
	private static Iterable = new PrimitiveType('Iterable');
	private static Iterator = new PrimitiveType('Iterator');
	public static Unknown = new PrimitiveType('Unknown');
	public static Invalid = new PrimitiveType('Invalid');
	
	static array(element:Type):ArrayType { return new ArrayType(element); }
	static func(retval:Type, args:Type[]):FunctionType { return new FunctionType(retval, args); }
	
	static canAssign(from:Type, to:Type):boolean {
		if (from == Types.Dynamic) return true;
		if (to == Types.Dynamic) return true;
		return from == to;
	}
	
	static classType(clazz:IrClass) {
		return new ClassType(clazz);
	}
	
	static holder():HolderType {
		return new HolderType();
	}
	
	static iterable(type:Type):SpecificType {
		return new SpecificType(Types.Iterable, [type]);
	}
	static iterator(type:Type):SpecificType {
		return new SpecificType(Types.Iterable, [type]);
	}

	static isSpecificBaseType(type:Type, base:Type) {
		return type instanceof SpecificType && type.base == base;
	}
	
	static fromString(name:string, resolver:Resolver):Type {
		switch (name) {
			case 'Int': return Types.Int;
			case 'Bool': return Types.Bool;
			default: throw new Error(`Unknown type '${name}'`);
		}
		return null;
	}
	
	static isIterable(type:Type) { return Types.isSpecificBaseType(type, Types.Iterable); }
	static isIterator(type:Type) { return Types.isSpecificBaseType(type, Types.Iterator); }
	
	static getElement(type:Type) {
		if (type instanceof SpecificType && type.specifics.length) {
			return type.specifics[0];
		}
		if (type instanceof ArrayType) return type.element;
		return Types.Unknown;
	}
	
	static getReturnType(type:Type):Type {
		if (type instanceof FunctionType) return type.retval;
		return type;
	}
	
	static unify(types:Type[]) {
		return types[0];
	}
	
	static access(type:Type, name:string):IrMember {
		if (type instanceof ClassType) {
			return type.clazz.getMember(name);
		}
		throw `Error .access Type(${type}) : Name(${name})`;
		//if (type instanceof FunctionType) return type.retval;
		//return type;
	}
}
export class Node {
	constructor(public psi:E) { }
	get nodeKind() {
        return '' + (<any>this.constructor).name;
    }
	toString() {
		return this.nodeKind;
	}
} 

export class Expression extends Node {
	constructor(psi:E) { super(psi); }
	get type():Type { throw new Error(`Must override Expression[${classNameOf(this)}].type`); }
}
export class Statement extends Node { }
export class LeftValue extends Expression { }
export class BinOpNode extends Expression {
	public constructor(psi:E, public module:IrModule, public op:string, public left:Expression, public right:Expression) { super(psi); }
	get type() {
		let l = this.left, r = this.right;
		var ret:Type = Types.Unknown;
		switch (this.op) {
			case '=':
				ret = r.type;
				if (!ret) throw new Error('Binexp[1] type == null');
				break;
			case '==': case '!=': case '<': case '>': case '<=': case '>=':
			case '&&': case '||':
				ret = Types.Bool;
				break;
			default:
				var op = this.module.operators.getBinop(this.op, l.type, r.type);
				if (op == null) throw new Error(`BinOpNodeTemp: Unknown operator ${l.type} ${this.op} ${r.type}`);
				ret = op.result;
				if (!ret) throw new Error('Binexp[2] type == null');
				break;
		}
		return ret;
	}
}
export class UnopPost extends Expression {
	constructor(psi:E, public module:IrModule, public left:Expression, public op:string) { super(psi); }
	get type() { return this.left.type; }
}
export class ReturnNode extends Statement {
	public constructor(psi:E, public optValue?:Expression) {
		super(psi);
	}
	get type() { return this.optValue ? this.optValue.type : Types.Void; }
}

export class Immediate extends Expression {
	constructor(psi:E, private _type:Type, public value:any) { super(psi); }
	get type() { return this._type; }
}
export class UnknownExpression extends Expression {
	constructor(psi:E) { super(psi); }
	get type() { return Types.Unknown; }
}

export interface ResolverItem {
	type: Type;
	name: string;
}

export class UnknownItem {
	type = Types.Unknown;
	name = '$unknown$';
}

export class Resolver {
	get(name:string):ResolverItem {
		let result = this._get(name);
		if (result == null) {
			console.warn(new Error(`Can't find '${name}' at ${this}`));
			return new UnknownItem();
		}
		return result;
	}
	
	protected _get(name:string):ResolverItem {
		return null;
	}
	
	toString() { return '$RESOLVER'; }
}

export class ResolverGroup {
	resolvers: Resolver[] = [];
	add(resolver: Resolver) {
		this.resolvers.push(resolver);
	}
	get(name:string):ResolverItem {
		for (let resolver of this.resolvers) {
			let result = resolver.get(name);
			if (result != null) return result;
		}
		return null;
	}

	toString() { return 'Group(' + this.resolvers.join(', ') + ')'; }
}

export class ModuleResolver extends Resolver {
	constructor(public module:IrModule) { super(); }
	
	get(name:string) {
		for (let clazz of this.module.classes) {
			if (clazz.name == name) return clazz;
		}
		return null;
	}

	toString() { return `Module()`; }
}

export class ParametersResolver extends Resolver {
	constructor(public params:IrParameters) { super(); }
	
	get(name:string) {
		for (let param of this.params.params.reverse()) {
			if (param.name == name) return param;
		}
		return null;
	}

	toString() { return `Parameters(${this.params.method.name})`; }
}

export class MembersResolver extends Resolver {
	constructor(public clazz:IrClass) { super(); }
	
	get(name:string) {
		return this.clazz.getMember(name);
	}
	
	toString() { return `Members(${this.clazz.fqname})`; }
}

export class LocalResolver extends Resolver {
	vars = new Map<string, ResolverItem>();
	
	constructor(public parent:Resolver) {
		super();
	}
	
	child() {
		return new LocalResolver(this);
	}
	
	add(local:ResolverItem) {
		this.vars.set(local.name, local);
	}
	
	protected _get(name:string):ResolverItem {
		var result:ResolverItem = null;
		if (result == null) result = this.vars.get(name);
		if (result == null && this.parent) result = this.parent.get(name);
		return result;
	}	

	toString() { return `Locals(${this.vars.size})(${this.parent})`; }
}

export class MethodResolver extends LocalResolver {
	private group = new ResolverGroup();
	constructor(public method:IrMethod) {
		super(null);
		this.group.add(new ModuleResolver(method.containingClass.module));
		this.group.add(new MembersResolver(method.containingClass));
		this.group.add(new ParametersResolver(method.params));
	}
	get(name:string) { return this.group.get(name); }

	toString() { return `Method(${this.vars.size})(${this.method.fqname},${this.group})`; }
}

export class Statements extends Statement {
	public constructor(psi:E, public nodes:Node[]) {
		super(psi);
		this.nodes = this.nodes.slice();
	}
	
	add(node:Node) {
		this.nodes.push(node);
	}
}

export class AnalyzerResult {
	returns:ReturnNode[] = [];
	
	get returnType() {
		return Types.unify(this.returns.map(r => r.type));
	}
}

export class Visitor {
	protected currentModule:IrModule = null;
	protected currentClass:IrClass = null;
	protected currentMethod:IrMethod = null;
	
	module(module:IrModule):void {
		this.currentModule = module;
		for (let clazz of module.classes) {
			this.clazz(clazz);
		}
		this.currentModule = null;
	}
	
	clazz(clazz:IrClass) {
		this.currentClass = clazz;
		for (let method of clazz.methods) {
			this.method(method);
		}
		this.currentClass = null;
	}
	
	method(method:IrMethod) {
		this.currentMethod = method;
		this.node(method.body);
		this.currentMethod = null;
	}
	
	node(node:Node):void {
		if (node == null) return;
		if (node instanceof ReturnNode) { this.nodeReturn(node); return; }
		if (node instanceof Statements) {
			for (let child of node.nodes) this.node(child);
			this.nodeStatements(node);
			return;
		}
		if (node instanceof ExpressionStm) { this.node(node.expression); this.nodeExpressionStm(node); return; }
		if (node instanceof BinOpNode) { this.node(node.left); this.node(node.right); this.nodeBinop(node); return; }
		if (node instanceof LocalExpression) { this.localExpr(node); return; }
		if (node instanceof Immediate) { this.immediate(node); return; }
		if (node instanceof IfNode) { this.node(node.expr); this.node(node.trueStm); this.node(node.falseStm); this.ifNode(node); return; }
		if (node instanceof WhileNode) { this.node(node.expr); this.node(node.body); this.whileNode(node); return; }
		if (node instanceof FastForNode) { this.node(node.body); this.fastForNode(node); return; }
		if (node instanceof Fast2ForNode) { this.node(node.body); this.node(node.min); this.node(node.max); this.fast2ForNode(node); return; }
		if (node instanceof ForNode) { this.node(node.body); this.node(node.expr); this.forNode(node); return; }
		if (node instanceof UnopPost) { this.node(node.left); this.unopPost(node); return; }
		if (node instanceof MemberAccess) { this.node(node.left); this.memberAccess(node); return; }
		if (node instanceof NewExpression) { for (let arg of node.args) this.node(arg); this.newExpression(node); return; }
		throw new Error(`Can't handle ir.node ${classNameOf(node)} :: ${node}`);
	}
	
	newExpression(node:NewExpression) { }
	memberAccess(node:MemberAccess) { }
	unopPost(node:UnopPost) { }
	forNode(node:ForNode) { }
	fastForNode(node:FastForNode) { }
	fast2ForNode(node:Fast2ForNode) { }
	whileNode(node:WhileNode) { }
	ifNode(node:IfNode) { }
	immediate(node:Immediate) { }
	localExpr(node:LocalExpression) { }
	nodeBinop(node:BinOpNode) { }
	nodeExpressionStm(node:ExpressionStm) { }
	nodeReturn(node:ReturnNode) { }
	nodeStatements(node:Statements) { }
}

export class Analyzer extends Visitor {
	result = new AnalyzerResult();
	
	constructor(public errors:ErrorList) {
		super();
		if (this.errors == null) this.errors = new ErrorList();
	}
	
	static analyzeModule(module:IrModule, errors?:ErrorList):AnalyzerResult {
		let analyzer = new Analyzer(errors);
		analyzer.module(module);
		return analyzer.result;
	}
	
	static analyze(node:Node, errors?:ErrorList):AnalyzerResult {
		let analyzer = new Analyzer(errors);
		analyzer.node(node);
		return analyzer.result;
	}
	
	nodeReturn(node:ReturnNode) { 
		//trace(`Analyzing return ${this.currentMethod}`);
		if (!Types.canAssign(this.currentMethod.returnType, node.type)) {
			this.errors.add(new ErrorInfo(node.psi, `Can't assign ${node.type} to ${this.currentMethod.returnType}`));
		}
		this.result.returns.push(node);
	}
}

export class ExpressionStm extends Statement { constructor(psi:E, public expression:Expression) { super(psi); } }
export class IfNode extends Statement { constructor(psi:E, public expr:Expression, public trueStm:Statement, public falseStm:Statement) { super(psi); } }
export class ForNode extends Statement { constructor(psi:E, public local:IrLocal, public expr:Expression, public body:Statement) { super(psi); } }
export class FastForNode extends Statement { constructor(psi:E, public local:IrLocal, public min:number, public max:number, public body:Statement) { super(psi); } }
export class Fast2ForNode extends Statement { constructor(psi:E, public local:IrLocal, public min:Expression, public max:Expression, public body:Statement) { super(psi); } }
export class WhileNode extends Statement { constructor(psi:E, public expr:Expression, public body:Statement) { super(psi); } }

export class CallExpression extends Expression { constructor(psi:E, public left:Expression, public args:Expression[], public retval:Type) { super(psi); } get type() { return this.retval; } }
export class NewExpression extends Expression { constructor(psi:E, public clazz:IrClass, public args:Expression[]) { super(psi); } get type() { return Types.classType(this.clazz); } }
export class LocalExpression extends LeftValue { constructor(psi:E, public local:IrLocal) { super(psi); } get type() { return this.local.type; } }
export class MemberExpression extends LeftValue { constructor(psi:E, public member:IrMember) { super(psi); } get type() { return this.member.type; } }
export class ClassExpression extends LeftValue { constructor(psi:E, public clazz:IrClass) { super(psi); } get type() { return Types.classType(this.clazz); } }
export class ArgumentExpression extends LeftValue { constructor(psi:E, public arg:IrParameter) { super(psi); } get type() { return this.arg.type; } }
export class ThisExpression extends LeftValue { constructor(psi:E, public clazz:Type) { super(psi); } get type() { return this.clazz; } }
export class MemberAccess extends LeftValue { constructor(psi:E, public left:Expression, public member:IrMember) { super(psi); } get type() { return this.member.type; } }
export class ArrayAccess extends LeftValue { constructor(psi:E, public left:Expression, public index:Expression) { super(psi); } get type() { return Types.getElement(this.left.type); } }

var oops = [
    ["**"],
    ["%"],
    ["*", "/"],
    ["+", "-"],
    ["<<", ">>", ">>>"],
    ["|", "&", "^"],
    ["<=>", "==", "!=", ">", "<", ">=", "<="],
    ["..."],
    ["&&"],
    ["||"],
    ["=","+=","-=","*=","/=","%=","<<=",">>=",">>>=","|=","&=","^="],
];
var priorityOps:{ [op:string]:number; } = {};

for (var priority = 0; priority < oops.length; priority++) {
    let oop = oops[priority];
    for (let op of oop) priorityOps[op] = priority + 1;
}

export class NodeBuilder {
	constructor(public module:IrModule) {
	}
	stms(psi:E, list:Statement[]) { return new Statements(psi, list); }
	ret(psi:E, expr?:Expression) { return new ReturnNode(psi, expr); }
	exprstm(psi:E, expr?:Expression) { return new ExpressionStm(psi, expr); }
	int(psi:E, value:number) { return new Immediate(psi, Types.Int, value | 0); }
	unknown(psi:E) { return new UnknownExpression(psi); }
	call(psi:E, left:Expression, args:Expression[], retval:Type):Expression {
		if (left instanceof ClassExpression) {
			return new NewExpression(psi, left.clazz, args);
		}
		return new CallExpression(psi, left, args, retval);
	}
	access(psi:E, left:Expression, member:IrMember) { return new MemberAccess(psi, left, member); }
	arrayAccess(psi:E, left:Expression, index:Expression) { return new ArrayAccess(psi, left, index); }
	_if(psi:E, e:Expression, t:Statement, f:Statement) { return new IfNode(psi, e, t, f); }
	_for(psi:E, local:IrLocal, e:Expression, body:Statement):Statement {
		if (e instanceof BinOpNode) {
			if (e.op == '...') {
				let l = e.left, r = e.right;
				if (l instanceof Immediate && r instanceof Immediate && l.type == Types.Int && r.type == Types.Int) {
					return new FastForNode(psi, local, l.value, r.value, body);
				}
				return new Fast2ForNode(psi, local, l, r, body);
			}
		}
		return new ForNode(psi, local, e, body);
	}
	_while(psi:E, e:Expression, code:Statement) { return new WhileNode(psi, e, code); }
	unopPost(psi:E, expr:Expression, op:string) { return new UnopPost(psi, this.module, expr, op); }
	binops(psi:E, operators:string[], exprs:Expression[]) {
		if (exprs.length == 1) return exprs[0];
        var prev = exprs.shift();
        var prevPriority:number = 0;
        for (let op of operators) {
            let next = exprs.shift();
            let nextPriority = priorityOps[op];
			if (nextPriority === undefined) throw new Error(`Can't find operator ${op}`);
            if ((prev instanceof BinOpNode) && nextPriority < prevPriority) {
                var pbop = <BinOpNode>prev;
                prev = new BinOpNode(psi, this.module, pbop.op, pbop.left, new BinOpNode(psi, this.module, op, pbop.right, next))
            } else {
                prev = new BinOpNode(psi, this.module, op, prev, next);
            }
            prevPriority = nextPriority;
        }

        return prev;
	}
	_this(psi:E, clazz:Type) { return new ThisExpression(psi, clazz); }
	local(psi:E, local:IrLocal) { return new LocalExpression(psi, local); }
	member(psi:E, member:IrMethod) { return new MemberExpression(psi, member); }
	class(psi:E, clazz:IrClass) { return new ClassExpression(psi, clazz); }
	arg(psi:E, arg:IrParameter) { return new ArgumentExpression(psi, arg); }
	assign(psi:E, left:Expression, right:Expression) {
		return new BinOpNode(psi, this.module, '=', left, right);
	}
}
