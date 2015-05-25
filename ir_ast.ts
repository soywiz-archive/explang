export class IrModule {
	public classes:IrClass[];
}

export class IrMember {
	public name:string;
}

export class IrMethod extends IrMember {
}

export class IrField extends IrMember {
	
}

export class IrScope {
	
}

export class IrClass {
	public fields:IrField[] = [];
	public methods:IrMethod[] = [];
}

export class Type {
	public static Void = new VoidType();
	public static Int = new IntType();
	public static Long = new LongType();
	public static Float = new FloatType();
	public static Double = new DoubleType();
	public static String = new StringType();
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
	public constructor(public type:Type, public optValue?:Node) {
		super();
	}
}