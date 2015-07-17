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
	
	public constructor(public name:string, public isStatic:boolean, public containingClass:IrClass, public body:Statements) {
		super(name, containingClass);
		containingClass.methods.push(this);
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
}

export class Node {
	getType():Type { throw 'Must override'; }    
	get nodeKind() {
        return '' + (<any>this.constructor).name;
    }
	toString() {
		return this.nodeKind;
	}
} 

export class Expression extends Node { }
export class Statement extends Node { }

export class BinOpNode extends Expression {
	//public constructor(public type:Type, public op:string, public l:Node, public r:Node) {
    public constructor(public op:string, public l:Node, public r:Node) {
		super();
	}
	
	public check() {
		//l.get
	}

	getType():Type { return this.l.getType(); }
}

export class ReturnNode extends Statement {
	public constructor(public optValue?:Expression) {
		super();
	}
	
	getType():Type {
		return Types.Void;
		/*
		if (this.optValue != null) {
			return this.optValue.getType();
		} else {
			
		}
		*/
	}
}

export class ImmediateExpression extends Expression {
	constructor(public type:Type, public value:any) {
		super();
	}
	getType():Type {
		return this.type;
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
	constructor(public left:Expression, public args:Expression[]) {
		super();
	}
}

export class IdExpression extends Expression {
	public constructor(public id:string) {
		super();
	}
}

export class AssignExpression extends Expression {
	constructor(public left:Expression, public right:Expression) {
		super();
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
	call(left:Expression, args:Expression[]) { return new CallExpression(left, args); }
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
                prev = new BinOpNode(pbop.op, pbop.l, new BinOpNode(op, pbop.r, next))
            } else {
                prev = new BinOpNode(op, prev, next);
            }
            prevPriority = nextPriority;
        }

        return prev;
	}
	id(id:string) { return new IdExpression(id); }
	assign(left:Expression, right:Expression) {
		return new AssignExpression(left, right);
	}
}
