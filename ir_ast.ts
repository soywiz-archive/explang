/// <reference path="./defs.d.ts" />

import { Map2, Map3 } from './utils';

export class IrModule {
	public classes:IrClass[] = [];
	public operators = new IrOperators();
	
	constructor() {
		for (let op of ['+', '-', '*', '%', '**', '<=>',
			'+=']) {
			this.operators.addBinop(new IrOperator(this, op, Types.Int, Types.Int, Types.Int, null));
		}
			this.operators.addBinop(new IrOperator(this, '...', Types.Int, Types.Int, Types.Iterable, null));
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
	type: Type;
		
	public constructor(public name:string, public containingClass:IrClass) {
	}
	
	get module() { return this.containingClass.module; }
}

export class IrLocal {
	constructor(public name:string, public type:Type, public method:IrMethod) {
	}
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
	
	public constructor(public name:string, public retval:Type, public modifiers:IrModifiers, public containingClass:IrClass, public body:Statements) {
		super(name, containingClass);
		this.resolver = new LocalResolver(new MethodResolver(this));
	}
	
	get fqname() { return this.containingClass.name + '::' + this.name; }
	
	addParam(name:string, type:Type, init?:Expression) {
		return this.params.addParam(name, type, init);
	}
	
	createLocal(name:string, type:Type) {
		let local = new IrLocal(name, type, this);
		this.locals.push(local);
		return local;
	}
}

export class IrField extends IrMember {

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
	
	constructor(public name:string, public module:IrModule) {
		module.classes.push(this);
		this.type = new ClassType(this);
	}
	
	get fqname() { return this.name; }
	
	getMember(name:string) {
		return this.members.get(name);
	}
	
	createMethod(name:string, retval:Type, modifiers:IrModifiers, body:Statements) {
		let method = new IrMethod(name, retval, modifiers, this, body);
		this.methods.push(method);
		this.members.set(name, method);
		return method;
	}
}

export class Type {
	toString() { return '$TYPE'; }
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
	toString() { return this.element + '[]'; }
}

export class FunctionType extends Type {
	public constructor(public retval:Type, public args:Type[]) { super(); }
	toString() { return '(' + this.args.join(', ') + ') => ' + this.retval; }
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
	public static Iterable = new PrimitiveType('Iterable');
	public static Iterator = new PrimitiveType('Iterator');
	public static Unknown = new PrimitiveType('Unknown');
	
	static array(element:Type):ArrayType { return new ArrayType(element); }
	static func(retval:Type, args:Type[]):FunctionType { return new FunctionType(retval, args); }
	
	static getElement(type:Type) {
		if (type instanceof ArrayType) return type.element;
		return Types.Unknown;
	}
	
	static getReturnType(type:Type):Type {
		if (type instanceof FunctionType) return type.retval;
		return type;
	}
	
	static access(type:Type, name:string):IrMember {
		if (type instanceof ClassType) {
			return type.clazz.getMember(name);
		}
		throw 'Error .access';
		//if (type instanceof FunctionType) return type.retval;
		//return type;
	}
}
export class Node {
	get nodeKind() {
        return '' + (<any>this.constructor).name;
    }
	toString() {
		return this.nodeKind;
	}
} 

export class Expression extends Node { constructor(public type:Type) { super(); } }
export class Statement extends Node { }
export class LeftValue extends Expression { }
export class BinOpNode extends Expression { public constructor(type:Type, public op:string, public l:Expression, public r:Expression) { super(type); } }
export class UnopPost extends Expression { constructor(type:Type, public l:Expression, public op:string) { super(type); } }
export class ReturnNode extends Statement {
	type: Type;
	public constructor(public optValue?:Expression) {
		super();
		this.type = optValue ? optValue.type : Types.Void;
	}
}

export class ImmediateExpression extends Expression { constructor(type:Type, public value:any) { super(type); } }
export class UnknownExpression extends Expression { constructor() { super(Types.Unknown); } }

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

export class ParametersResolver extends Resolver {
	constructor(public params:IrParameters) { super(); }
	
	get(name:string) {
		for (let param of this.params.params.reverse()) {
			if (param.name == name) return param;
		}
		return null;
	}

	toString() { return 'Parameters(' + this.params.method.name + ')'; }
}

export class MembersResolver extends Resolver {
	constructor(public clazz:IrClass) { super(); }
	
	get(name:string) {
		return this.clazz.getMember(name);
	}
	
	toString() { return 'Members(' + this.clazz.fqname + ')'; }
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

	toString() { return 'Locals(' + this.vars.size + ')(' + this.parent + ')'; }
}

export class MethodResolver extends LocalResolver {
	private group = new ResolverGroup();
	constructor(public method:IrMethod) {
		super(null);
		this.group.add(new MembersResolver(method.containingClass));
		this.group.add(new ParametersResolver(method.params));
	}
	get(name:string) { return this.group.get(name); }

	toString() { return 'Method(' + this.vars.size + ')(' + this.method.fqname + ',' + this.group + ')'; }
}

export class Statements extends Statement {
	public constructor(public nodes:Node[]) {
		super();
		this.nodes = this.nodes.slice();
	}
	
	add(node:Node) {
		this.nodes.push(node);
	}
}

export class ExpressionStm extends Statement { constructor(public expression:Expression) { super(); } }
export class IfNode extends Statement { constructor(public e:Expression, public t:Statement, public f:Statement) { super(); } }
export class WhileNode extends Statement { constructor(public e:Expression, public body:Statement) { super(); } }
export class CallExpression extends Expression { constructor(public left:Expression, public args:Expression[], public retval:Type) { super(retval); } }
export class LocalExpression extends LeftValue { constructor(public local:IrLocal) { super(local.type); } }
export class MemberExpression extends LeftValue { constructor(public member:IrMember) { super(member.type); } }
export class ArgumentExpression extends LeftValue { constructor(public arg:IrParameter) { super(arg.type); } }
export class ThisExpression extends LeftValue { constructor(public clazz:Type) { super(clazz); } }
export class MemberAccess extends LeftValue { constructor(public left:Expression, public member:IrMember) { super(member.type); } }
export class ArrayAccess extends LeftValue { constructor(public left:Expression, public index:Expression) { super(Types.getElement(left.type)); } }

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

class BinOpNodeTemp extends Expression {
	constructor(public op:string, public l:Expression, public r:Expression) { super(null); }
	
	convert(module:IrModule):BinOpNode {
		var l = (this.l instanceof BinOpNodeTemp) ? (<BinOpNodeTemp>this.l).convert(module) : this.l;
		var r = (this.r instanceof BinOpNodeTemp) ? (<BinOpNodeTemp>this.r).convert(module) : this.r;
		var ret:Type = Types.Unknown;
		switch (this.op) {
			case '=': ret = r.type; break;
			case '==': case '!=': case '<': case '>': case '<=': case '>=':
			case '&&': case '||':
				ret = Types.Bool;
				break;
			default:
				var op = module.operators.getBinop(this.op, l.type, r.type);
				if (op == null) throw new Error(`Unknown operator ${l.type} ${this.op} ${r.type}`);
				ret = op.result;
				break;
		}
		return new BinOpNode(ret, this.op, l, r);
	}
}


export class NodeBuilder {
	constructor(public module:IrModule) {
	}
	stms(list:Statement[]) { return new Statements(list); }
	ret(expr?:Expression) { return new ReturnNode(expr); }
	exprstm(expr?:Expression) { return new ExpressionStm(expr); }
	int(value:number) { return new ImmediateExpression(Types.Int, value | 0); }
	unknown() { return new UnknownExpression(); }
	call(left:Expression, args:Expression[], retval:Type) { return new CallExpression(left, args, retval); }
	access(left:Expression, member:IrMember) { return new MemberAccess(left, member); }
	arrayAccess(left:Expression, index:Expression) { return new ArrayAccess(left, index); }
	_if(e:Expression, t:Statement, f:Statement) { return new IfNode(e, t, f); }
	_while(e:Expression, code:Statement) { return new WhileNode(e, code); }
	unopPost(expr:Expression, op:string) { return new UnopPost(expr.type, expr, op); }
	binops(operators:string[], exprs:Expression[]) {
		if (exprs.length == 1) return exprs[0];
        var prev = exprs.shift();
        var prevPriority:number = 0;
        for (let op of operators) {
            let next = exprs.shift();
            let nextPriority = priorityOps[op];
			if (nextPriority === undefined) throw new Error(`Can't find operator ${op}`);
            if ((prev instanceof BinOpNodeTemp) && nextPriority < prevPriority) {
                var pbop = <BinOpNodeTemp>prev;
                prev = new BinOpNodeTemp(pbop.op, pbop.l, new BinOpNodeTemp(op, pbop.r, next))
            } else {
                prev = new BinOpNodeTemp(op, prev, next);
            }
            prevPriority = nextPriority;
        }

        return (<BinOpNodeTemp>prev).convert(this.module);
	}
	_this(clazz:Type) { return new ThisExpression(clazz); }
	local(local:IrLocal) { return new LocalExpression(local); }
	member(member:IrMethod) { return new MemberExpression(member); }
	arg(arg:IrParameter) { return new ArgumentExpression(arg); }
	assign(left:Expression, right:Expression) {
		return new BinOpNode(right.type, '=', left, right);
	}
}
