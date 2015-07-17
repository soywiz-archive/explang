export class IrModule {
	public classes:IrClass[] = [];
	
	createClass(name:string) {
		return new IrClass(name, this);
	}
}

export class IrMember {
	public constructor(public name:string, public containingClass:IrClass) {
	}
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

export class ArrayType extends Type {
	public constructor(public element:Type) { super(); }
}

export class FunctionType extends Type {
	public constructor(public retval:Type, public args:Type[]) { super(); }
}

export class VoidType extends Type { }
export class IntType extends Type { }
export class LongType extends Type { }
export class FloatType extends Type { }
export class DoubleType extends Type { }
export class StringType extends Type { }

export class Types {
	public static Void = new VoidType();
	public static Int = new IntType();
	public static Long = new LongType();
	public static Float = new FloatType();
	public static Double = new DoubleType();
	public static String = new StringType();
	public static Unknown = new StringType();
	
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

export class Expression extends Node {
	constructor(public type:Type) {
		super();
	}
}
export class Statement extends Node { }

export class LeftValue extends Expression {
	
}

export class BinOpNode extends Expression {
	public constructor(type:Type, public op:string, public l:Expression, public r:Expression) {
		super(type);
	}
	
	public check() {
		//l.get
	}
}

export class ReturnNode extends Statement {
	public constructor(public optValue?:Expression) {
		super();
	}
}

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

export class ExpressionStm extends Statement {
	public constructor(public expression:Expression) {
		super();
	}
}

export class IfNode extends Statement {
	public constructor(public e:Node, public t:Node, public f:Node) {
		super();
	}
}

export class CallExpression extends Expression {
	constructor(public left:Expression, public args:Expression[], public retval:Type) {
		super(retval);
	}
}

export class IdExpression extends LeftValue {
	public constructor(public id:string, type:Type) {
		super(type);
	}
}

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
    for (let op of oop) {
        priorityOps[op] = priority + 1;
    }
}


export class NodeBuilder {
	stms(list:Statement[]) { return new Statements(list); }
	ret(expr?:Expression) { return new ReturnNode(expr); }
	exprstm(expr?:Expression) { return new ExpressionStm(expr); }
	int(value:number) { return new ImmediateExpression(Types.Int, value | 0); }
	call(left:Expression, args:Expression[], retval:Type) { return new CallExpression(left, args, retval); }
	_if(e:Expression, t:Statement, f:Statement) { return new IfNode(e, t, f); }
	binops(operators:string[], exprs:Expression[]) {
		if (exprs.length == 1) return exprs[0];
        var prev = exprs.shift();
        var prevPriority:number = 0;
        for (let op of operators) {
            let next = exprs.shift();
            let nextPriority = priorityOps[op] | 0;
            if ((prev instanceof BinOpNode) && nextPriority < prevPriority) {
                var pbop = <BinOpNode>prev;
                prev = new BinOpNode(pbop.l.type, pbop.op, pbop.l, new BinOpNode(pbop.l.type, op, pbop.r, next))
            } else {
                prev = new BinOpNode(prev.type, op, prev, next);
            }
            prevPriority = nextPriority;
        }

        return prev;
	}
	id(id:string, type:Type) { return new IdExpression(id, type); }
	assign(left:Expression, right:Expression) {
		return new BinOpNode(right.type, '=', left, right);
	}
}
