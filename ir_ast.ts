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

export class IrMethod extends IrMember {
	public constructor(public name:string, public containingClass:IrClass, public body:Node) {
		super(name, containingClass);
		containingClass.methods.push(this);
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
	
	createMethod(name:string, body:Node) {
		return new IrMethod(name, this, body);
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
}

export class Node {
	getType():Type { throw 'Must override'; }
} 

export class BinOpNode extends Node {
	public constructor(public type:Type, public op:string, public l:Node, public r:Node) {
		super();
	}
	
	public check() {
		//l.get
	}

	getType():Type { return this.type; }
}

export class ReturnNode extends Node {
	public constructor(public optValue?:Node) {
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

export class ImmediateNode extends Node {
	constructor(public value:any) {
		super();
	}
	getType():Type {
		// @TODO: proper type
		return Types.Int;
	}
}

export class Statements extends Node {
	public constructor(public nodes:Node[]) {
		super();
	}
}

export class NodeBuilder {
	stms(list:Node[]) { return new Statements(list); }
	ret(expr?:Node) { return new ReturnNode(expr); }
	imm(value:any) { return new ImmediateNode(value); }
}