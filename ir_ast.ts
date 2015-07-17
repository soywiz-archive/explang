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
	public constructor(public name:string, public containingClass:IrClass) {
	}
	
	get module() { return this.containingClass.module; }
}

export class IrLocal {
	constructor(public name:string, public type:Type, public method:IrMethod) {
	}
}

export class IrMethod extends IrMember {
	locals: IrLocal[] = [];
	resolver: LocalResolver;
	
	public constructor(public name:string, public isStatic:boolean, public containingClass:IrClass, public body:Statements) {
		super(name, containingClass);
		containingClass.methods.push(this);
		this.resolver = new LocalResolver(null);
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

export class IrClass {
	public fields:IrField[] = [];
	public methods:IrMethod[] = [];
	
	constructor(public name:string, public module:IrModule) {
		module.classes.push(this);
	}
	
	createMethod(name:string, isStatic:boolean, body:Statements) {
		return new IrMethod(name, isStatic, this, body);
	}
}

export class Type {

}

export class PrimitiveType extends Type {
	constructor(public name:String) { super(); }
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
	public static Long = new PrimitiveType('Long');
	public static Float = new PrimitiveType('Float');
	public static Double = new PrimitiveType('Double');
	public static String = new PrimitiveType('String');
	public static Iterable = new PrimitiveType('Iterable');
	public static Iterator = new PrimitiveType('Iterator');
	public static Unknown = new PrimitiveType('Unknown');
	
	static array(element:Type):ArrayType { return new ArrayType(element); }
	static func(retval:Type, args:Type[]):FunctionType { return new FunctionType(retval, args); }
	
	static getReturnType(type:Type):Type {
		if (type instanceof FunctionType) return type.retval;
		return type;
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
export class ReturnNode extends Statement { public constructor(public optValue?:Expression) { super(); } }

export class ImmediateExpression extends Expression {
	constructor(type:Type, public value:any) {
		super(type);
	}
}

export interface ResolverItem {
	type: Type;
	name: string;
}

export class Resolver {
	get(name:string):ResolverItem {
		let result = this._get(name);
		if (result == null) throw new Error(`Can't find '${name}'`);
		return result;
	}
	
	protected _get(name:string):ResolverItem {
		return null;
	}
}

export class LocalResolver extends Resolver {
	vars: { [key:string]:ResolverItem } = {};
	
	constructor(public parent:Resolver) {
		super();
	}
	
	add(local:ResolverItem) {
		this.vars[local.name] = local;
	}
	
	protected _get(name:string):ResolverItem {
		var result:ResolverItem = null;
		if (result == null) result = this.vars[name];
		if (result == null && this.parent) result = this.parent.get(name);
		return result;
	}	
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

export class ExpressionStm extends Statement { public constructor(public expression:Expression) { super(); } }
export class IfNode extends Statement { public constructor(public e:Expression, public t:Statement, public f:Statement) { super(); } }
export class WhileNode extends Statement { public constructor(public e:Expression, public body:Statement) { super(); } }
export class CallExpression extends Expression { constructor(public left:Expression, public args:Expression[], public retval:Type) { super(retval); } }
export class IdExpression extends LeftValue { public constructor(public id:string, type:Type) { super(type); } }

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
	call(left:Expression, args:Expression[], retval:Type) { return new CallExpression(left, args, retval); }
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
	id(id:string, type:Type) { return new IdExpression(id, type); }
	assign(left:Expression, right:Expression) {
		return new BinOpNode(right.type, '=', left, right);
	}
}
