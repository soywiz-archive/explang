/// <reference path="./defs.d.ts" />

import ir = require('./ir_ast');
import { Writer, Utf8Encoder } from './utils';

enum Constant {
	Utf8 = 1, Integer = 3, Float = 4, Long = 5,
	Double = 6, Class = 7, String = 8, Fieldref = 9,
	Methodref = 10, InterfaceMethodref = 11, NameAndType = 12,
}

class Type { toString():string { throw 'Must override'; } }
class PrimType extends Type { constructor(public v:string) { super(); } toString() { return this.v; } }
class RefType extends Type {
	public intfqname:string;
	constructor(public fqname:string) {
		super();
		this.intfqname = this.fqname.replace(/\./g, '/');
	}
	toString() { return 'L' + this.intfqname + ';'; }
}
class ArrayType extends Type {
	constructor(public element:Type) { super(); }
	toString() { return '[' + this.element.toString(); }
}

class Types {
	public static VOID = new PrimType('V'); // The character V indicates that the method returns no value (its return type is void).
	public static BYTE = new PrimType('B'); // B byte signed byte
	public static CHAR = new PrimType('C'); // C char Unicode character
	public static DOUBLE = new PrimType('D'); // D double double-precision floating-point value
	public static FLOAT = new PrimType('F'); // F float single-precision floating-point value
	public static INT = new PrimType('I'); // I int integer
	public static LONG = new PrimType('J'); // J long long integer
	public static SHORT = new PrimType('S'); // S short signed short
	public static BOOL = new PrimType('Z'); // Z boolean true or false
	public static STRING = Types.ref('java.lang.String');	
	static ref(fqname:string) { return new RefType(fqname); } // L Classname; reference an instance of class <classname>
	static array(other:Type) { return new ArrayType(other); } // [ reference one array dimension
}

class MethodType {
	public constructor(public args:Type[], public ret:Type) { }
	toString() {
		return '(' + this.args.join('') + ')' + this.ret;
	}
}

enum Opcode {
	nop = 0x0,
	aconst_null = 0x1,
	iconst_m1 = 0x2, iconst_0 = 0x3, iconst_1 = 0x4, iconst_2 = 0x5, iconst_3 = 0x6, iconst_4 = 0x7, iconst_5 = 0x8,
	lconst_0 = 0x9, lconst_1 = 0xa,
	fconst_0 = 0xb, fconst_1 = 0xc, fconst_2 = 0xd,
	dconst_0 = 0xe, dconst_1 = 0xf,

	// ....
	
	aload_0	= 0x2a, aload_1 = 0x2b, aload_2 = 0x2c, aload_3 = 0x2d,
	
	// ....
	
	iadd = 0x60, ladd = 0x61, fadd = 0x62, dadd = 0x63,
	isub = 0x64, lsub = 0x65, fsub = 0x66, dsub = 0x67,
	
	// ....
	ireturn	= 0xac, lreturn = 0xad, freturn = 0xae, dreturn = 0xaf, areturn = 0xb0, 'return' = 0xb1,
	
	invokespecial = 0xb7,
}

class BodyContext {
	public writer:Writer;
}

function irTypeToType(irtype:ir.Type) {
	switch (irtype) {
		case ir.Types.Void: return Types.VOID;
		case ir.Types.Int: return Types.INT;
		default: throw 'Unknown ir type to type conversion';
	}
}

function genbody(body:MethodBody, node:ir.Node) {
	if (node == null) throw 'Node must not be null';
	if (node instanceof ir.BinOpNode) {
		genbody(body, node.l);
		genbody(body, node.r);
		body.binop(node.op, irTypeToType(node.type));
	} else if (node instanceof ir.ReturnNode) {
		if (node.type != ir.Types.Void) genbody(body, node.optValue);
		body.ret(irTypeToType(node.type));
	} else {
		throw `Not implemented node ${node}!`;
	}
}

class LineNumberEntry {
	constructor(public pc:number, public line:number) {}
	write(w:Writer) {
		w.u16(this.pc);
		w.u16(this.line);
	}
}

class MethodBody {
	private data: Writer = new Writer();
	private stack: Type[] = [];
	private maxStack: number = 0;
	private lines: LineNumberEntry[] = [];
	
	get size() { return this.data.length; }
	
	constructor(private pool: ConstantPool) {
	}

	private _pop() {
		return this.stack.pop();
	}
	
	private _push(type:Type) {
		this.stack.push(type);
		this.maxStack = Math.max(this.maxStack, this.stack.length);
	}
	
	line(line:number) {
		this.lines.push(new LineNumberEntry(this.data.position, line));
	}
	
	aload(index:number) {
		if (index >= 0 && index <= 3) {
			this.data.u8(Opcode.aload_0 + index);
		} else {
			throw 'Not implemented aload XXX';
		}
		this._push(Types.ref('...'));
	}
	
	invokespecial(method:MethodRef) {
		this.data.u8(Opcode.invokespecial);
		this.data.u16(method.index);
	}
	
	pushi(value:number) {
		const w = this.data;
		if (value >= -1 && value <= 5) {
			w.u8(Opcode.iconst_0 + value);
		} else {
			throw 'Not implemented this literal';
		}
		this._push(Types.INT);
	}
	
	binop(op:string, type:Type) {
		const w = this.data;
		this._pop();
		this._pop();
		this._push(type);
		
		switch (type) {
			case Types.INT:
				switch (op) {
					case '+': w.u8(Opcode.iadd); break;
					case '-': w.u8(Opcode.isub); break;
					default: throw 'Unknown type 2'; 
				}
				break;
			default:
				throw 'Unknown type';
		}
	}
	
	ret(type:Type) {
		const w = this.data;
		switch (type) {
			case Types.VOID: w.u8(Opcode['return']); break;
			case Types.INT: w.u8(Opcode.ireturn); break;
			case Types.LONG: w.u8(Opcode.lreturn); break;
			case Types.FLOAT: w.u8(Opcode.freturn); break;
			case Types.DOUBLE: w.u8(Opcode.dreturn); break;
			default: w.u8(Opcode.areturn); break;
		}
	}
	
	private exceptions:ExceptionEntry[] = [];
	private attributes:AttributeInfo[] = [];
	
	toUint8Array() {
		var w = new Writer();
		var code = this.data;
		w.u16(this.maxStack); // max_stack
		w.u16(0); // max_locals
		w.u32(code.length); // code_length
		w.data(code.toUint8Array());
		w.u16(this.exceptions.length);
		for (let e of this.exceptions) e.write(w);
		w.u16(this.attributes.length);
		for (let a of this.attributes) a.write(w);
		return w.toUint8Array();
	}
	
	linesToUIint8Array() {
		var w = new Writer();
		w.u16(this.lines.length);
		for (let line of this.lines) {
			line.write(w);
		}
		return w.toUint8Array();
	}
}

class ExceptionEntry {
	startPc:number;
	endPc:number;
	handlerPc:number;
	catchType:number;
	write(w:Writer) {
		w.u16(this.startPc);
		w.u16(this.endPc);
		w.u16(this.handlerPc);
		w.u16(this.catchType);
	}
}

enum JavaVersion {
	J2SE8 = 52,
	J2SE7 = 51,
	J2SE6_0 = 50,
	J2SE5_0 = 49,
	JDK1_4 = 48,
	JDK1_3 = 47,
	JDK1_2 = 46,
	JDK1_1 = 45.
}

enum ClassAccess {
	PUBLIC = 0x0001, //  Declared public; may be accessed from outside its package.
	FINAL = 0x0010, // Declared final; no subclasses allowed.
	SUPER = 0x0020, // Treat superclass methods specially when invoked by the invokespecial instruction.
	INTERFACE = 0x0200, // Is an interface, not a class.
	ABSTRACT = 0x0400, // Declared abstract; must not be instantiated.
	SYNTHETIC = 0x1000, // Declared synthetic; Not present in the source code.
	ANNOTATION = 0x2000, // Declared as an annotation type.
	ENUM = 0x4000, // Declared as an enum type
}

enum FieldAccess {
	PUBLIC = 0x0001, // Declared public, may be accessed from outside its package.
	PRIVATE = 0x0002, // Declared private, usable only within the defining class.
	PROTECTED = 0x0004, // Declared protected, may be accessed within subclasses.
	STATIC = 0x0008, // Declared static.
	FINAL = 0x0010, // Declared final, no further assignment after initialization.
	VOLATILE = 0x0040, // Declared volatile, cannot be cached.
	TRANSIENT = 0x0080, // Declared transient, not written or read by a persistent object manager.
	SYNTHETIC = 0x1000, // Declared synthetic, Not present in the source code.
	ENUM = 0x4000, // Declared as an element of an enum
}

enum MethodAccess {
	PUBLIC = 0x0001, // Declared public, may be accessed from outside its package.
	PRIVATE = 0x0002, // Declared private, accessible only within the defining class.
	PROTECTED = 0x0004, // Declared protected, may be accessed within subclasses.
	STATIC = 0x0008, // Declared static.
	FINAL = 0x0010, // Declared final, must not be overridden.
	SYNCHRONIZED = 0x0020, // Declared synchronized, invocation is wrapped in a monitor lock.
	BRIDGE = 0x0040, // A bridge method, generated by the compiler.
	VARARGS = 0x0080, // Declared with variable number of arguments.
	NATIVE = 0x0100, // Declared native, implemented in a language other than Java.
	ABSTRACT = 0x0400, // Declared abstract, no implementation is provided.
	STRICT = 0x0800, // Declared strictfp, floating-point mode is FP-strict
	SYNTHETIC = 0x1000, // Declared synthetic,	
}

class ConstantPool {
	entries:ConstantEntry[] = [null];
	strings = new Map<string, Utf8>();
	
	_alloc<T extends ConstantEntry>(e:T):T {
		e.index = this.entries.length;
		this.entries.push(e);
		return e;
	}
	
	classInfo(type:RefType):ClassInfo {
		// @AVOID DUPS
		return this._alloc(new ClassInfo(this.str(type.intfqname)));
	}
	
	methodref(clazz:ClassInfo, nameAndType:NameAndTypeInfo) {
		// @AVOID DUPS
		return this._alloc(new MethodRef(clazz, nameAndType));
	}
	
	nameandtype(name:string, type:Type) {
		return this._alloc(new NameAndTypeInfo(this.str(name), this.str(type.toString())));
	}
	
	str(str:string) {
		if (!this.strings.has(str)) {
			var utf8 = new Utf8(str);
			this._alloc(utf8);
			this.strings.set(str, utf8);
		}
		return this.strings.get(str);
	}
	
	get size() { return this.entries.length; }
	write(w:Writer) {
		w.u16(this.size); // constant_pool_count
		for (const entry of this.entries.slice(1)) entry.write(w);
	}
}

class ConstantEntry {
	public index:number;
	write(w:Writer) { throw 'Must override ConstantEntry.write'; }
}

class NameAndTypeInfo extends ConstantEntry {
	constructor(public name:Utf8, public type:Utf8) { super(); }
	write(w:Writer) { w.u8(Constant.NameAndType); w.u16(this.name.index); w.u16(this.type.index); }
}

class MethodRef extends ConstantEntry {
	constructor(public clazz:ClassInfo, public nameAndType:NameAndTypeInfo) { super(); }
	write(w:Writer) { w.u8(Constant.Methodref); w.u16(this.clazz.index); w.u16(this.nameAndType.index); }
}
class Utf8 extends ConstantEntry {
	public data:Uint8Array;
	constructor(public text:string) {
		super();
		this.data = Utf8Encoder.encode(text);
	}
	write(w:Writer) { w.u8(Constant.Utf8); w.u16(this.data.length); w.data(this.data); }
}
class ClassInfo extends ConstantEntry {
	constructor(public name:Utf8) { super(); }
	write(w:Writer) { w.u8(Constant.Class); w.u16(this.name.index); }
}
class AttributeInfo {
	constructor(public attribute_name:Utf8, public data:Uint8Array) { }
	
	write(w:Writer) {
		w.u16(this.attribute_name.index); // attribute_name_index
		w.u32(this.data.length);
		w.data(this.data);
	}
}
class FieldInfo {
	public attributes:AttributeInfo[] = [];
	
	constructor(public access:FieldAccess, public name:Utf8, public descriptor:Utf8) {
		
	}
	
	write(w:Writer) {
		w.u16(this.access); // access_flags
		w.u16(this.name.index); // name_index
		w.u16(this.descriptor.index); // descriptor_index
		w.u16(this.attributes.length); for (const a of this.attributes) a.write(w);
	}
}

class MethodInfo {
	public body: MethodBody;
	constructor(public pool:ConstantPool, public accessFlags:MethodAccess, public name:Utf8, public descriptor:Utf8) {
		this.body = new MethodBody(pool);		
	}
	
	write(w:Writer) {
		var attributes:AttributeInfo[] = [];
		if (this.body.size > 0) {
			attributes.push(new AttributeInfo(this.pool.str('Code'), this.body.toUint8Array()));
			attributes.push(new AttributeInfo(this.pool.str('LineNumberTable'), this.body.linesToUIint8Array()));
		}
		w.u16(this.accessFlags); // access_flags
		w.u16(this.name.index); // name_index
		w.u16(this.descriptor.index); // descriptor_index
		w.u16(attributes.length); for (const a of attributes) a.write(w);
	}
}

class ConstantClassInfo extends ConstantEntry { }
class JvmClass {
	public pool:ConstantPool = new ConstantPool();
	public access:ClassAccess = ClassAccess.PUBLIC;
	public this_class:ClassInfo = null;
	public super_class:ClassInfo = null;
	private interfaces:ClassInfo[] = [];
	private fields:FieldInfo[] = [];
	private methods:MethodInfo[] = [];
	private attributes:AttributeInfo[] = [];
	
	constructor(fqname:string) {
		let pool = this.pool;
		this.pool.str('Code'); // reserve Code string
		this.pool.str('LineNumberTable'); 
		this.this_class = pool.classInfo(Types.ref(fqname));
		this.super_class = pool.classInfo(Types.ref('java.lang.Object'));
		this.attributes.push(
			new AttributeInfo(pool.str('SourceFile'), new Writer().u16(pool.str('Example.java').index).toUint8Array())
		);
	}
	
	createField(access:FieldAccess, name:string, type:Type) {
		this.fields.push(new FieldInfo(access, this.pool.str(name), this.pool.str(type.toString())));
	}
	
	createMethod(access:MethodAccess, name:string, type:MethodType) {
		var method = new MethodInfo(this.pool, access, this.pool.str(name), this.pool.str(type.toString()));
		this.methods.push(method);
		return method;
	}
		
	public write(w:Writer) {
		w.u32(0xCAFEBABE); // magic
		w.u16(45); // minor
		w.u16(JavaVersion.J2SE6_0); // major
		this.pool.write(w);
		w.u16(this.access); // access_flags
		w.u16(this.this_class ? this.this_class.index : 0);
		w.u16(this.super_class ? this.super_class.index : 0);
		w.u16(this.interfaces.length); for (const int of this.interfaces) w.u16(int.index);
		w.u16(this.fields.length); for (const field of this.fields) field.write(w);
		w.u16(this.methods.length); for (const method of this.methods) method.write(w);
		w.u16(this.attributes.length); for (const attribute of this.attributes) attribute.write(w);
		return w;
	}
	
	generate() {
		return this.write(new Writer()).toUint8Array();
	}
}

export function generateExample() {
	const clazz = new JvmClass('Example');
	clazz.createField(FieldAccess.PUBLIC | FieldAccess.STATIC, 'test', Types.INT);
	
	var method = clazz.createMethod(MethodAccess.PUBLIC, '<init>', new MethodType([], Types.VOID));
	method.body.line(20);
	method.body.aload(0);
	var initNameAndType = clazz.pool.nameandtype('<init>', new MethodType([], Types.VOID));
	method.body.invokespecial(clazz.pool.methodref(clazz.super_class, initNameAndType));
	method.body.ret(Types.VOID);

	var method2 = clazz.createMethod(
		MethodAccess.PUBLIC | MethodAccess.STATIC,
		'main', new MethodType([Types.array(Types.STRING)], Types.VOID)
	);
		//var initNameAndType = clazz.pool.nameandtype('<init>', new MethodType([], Types.VOID));
	//method2.body.line(33);
	//method2.body.pushi(3);
	method2.body.ret(Types.VOID);

	return clazz.generate();
}

export function generate(module:ir.IrModule) {
	
}
