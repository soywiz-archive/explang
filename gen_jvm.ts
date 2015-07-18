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
	NOP = 0x0,
	ACONST_NULL = 0x1,
	ICONST_M1 = 0x2, ICONST_0 = 0x3, ICONST_1 = 0x4, ICONST_2 = 0x5, ICONST_3 = 0x6, ICONST_4 = 0x7, ICONST_5 = 0x8,
	LCONST_0 = 0x9, LCONST_1 = 0xa,
	FCONST_0 = 0xb, FCONST_1 = 0xc, FCONST_2 = 0xd,
	DCONST_0 = 0xe, DCONST_1 = 0xf,
	BIPUSH = 0x10, SIPUSH = 0x11, // BYTE / SHORT
	LDC = 0x12,// CPREF,
	LDC_W = 0x13,// CPREF_W,
	LDC2_W = 0x14,// CPREF_W,
	ILOAD = 0x15, LLOAD = 0x16, FLOAD = 0x17, DLOAD = 0x18, ALOAD = 0x19,// LOCAL,
	ILOAD_0 = 0x1a, ILOAD_1 = 0x1b, ILOAD_2 = 0x1c, ILOAD_3 = 0x1d,
	LLOAD_0 = 0x1e, LLOAD_1 = 0x1f, LLOAD_2 = 0x20, LLOAD_3 = 0x21,
	FLOAD_0 = 0x22, FLOAD_1 = 0x23, FLOAD_2 = 0x24, FLOAD_3 = 0x25,
	DLOAD_0 = 0x26, DLOAD_1 = 0x27, DLOAD_2 = 0x28, DLOAD_3 = 0x29,
	ALOAD_0 = 0x2a, ALOAD_1 = 0x2b, ALOAD_2 = 0x2c, ALOAD_3 = 0x2d,
	IALOAD = 0x2e, LALOAD = 0x2f, FALOAD = 0x30, DALOAD = 0x31, AALOAD = 0x32, BALOAD = 0x33, CALOAD = 0x34, SALOAD = 0x35,
	ISTORE = 0x36, LSTORE = 0x37, FSTORE = 0x38, DSTORE = 0x39, ASTORE = 0x3a,// LOCAL,
	ISTORE_0 = 0x3b, ISTORE_1 = 0x3c, ISTORE_2 = 0x3d, ISTORE_3 = 0x3e,
	LSTORE_0 = 0x3f, LSTORE_1 = 0x40, LSTORE_2 = 0x41, LSTORE_3 = 0x42,
	FSTORE_0 = 0x43, FSTORE_1 = 0x44, FSTORE_2 = 0x45, FSTORE_3 = 0x46,
	DSTORE_0 = 0x47, DSTORE_1 = 0x48, DSTORE_2 = 0x49, DSTORE_3 = 0x4a,
	ASTORE_0 = 0x4b, ASTORE_1 = 0x4c, ASTORE_2 = 0x4d, ASTORE_3 = 0x4e,
	IASTORE = 0x4f, LASTORE = 0x50, FASTORE = 0x51, DASTORE = 0x52, AASTORE = 0x53, BASTORE = 0x54, CASTORE = 0x55, SASTORE = 0x56,
	POP = 0x57, POP2 = 0x58,
	DUP = 0x59, DUP_X1 = 0x5a, DUP_X2 = 0x5b, DUP2 = 0x5c, DUP2_X1 = 0x5d, DUP2_X2 = 0x5e,
	SWAP = 0x5f,
	IADD = 0x60, LADD = 0x61, FADD = 0x62, DADD = 0x63,
	ISUB = 0x64, LSUB = 0x65, FSUB = 0x66, DSUB = 0x67,
	IMUL = 0x68, LMUL = 0x69, FMUL = 0x6a, DMUL = 0x6b,
	IDIV = 0x6c, LDIV = 0x6d, FDIV = 0x6e, DDIV = 0x6f,
	IREM = 0x70, LREM = 0x71, FREM = 0x72, DREM = 0x73,
	INEG = 0x74, LNEG = 0x75, FNEG = 0x76, DNEG = 0x77,
	ISHL = 0x78, LSHL = 0x79, ISHR = 0x7a, LSHR = 0x7b, IUSHR = 0x7c, LUSHR = 0x7d,
	IAND = 0x7e, LAND = 0x7f,
	IOR = 0x80, LOR = 0x81,
	IXOR = 0x82, LXOR = 0x83,
	IINC = 0x84,// LOCAL_BYTE,
	I2L = 0x85, I2F = 0x86, I2D = 0x87,
	L2I = 0x88, L2F = 0x89, L2D = 0x8a,
	F2I = 0x8b, F2L = 0x8c, F2D = 0x8d,
	D2I = 0x8e, D2L = 0x8f, D2F = 0x90,
	I2B = 0x91, I2C = 0x92, I2S = 0x93,
	LCMP = 0x94, FCMPL = 0x95, FCMPG = 0x96, DCMPL = 0x97, DCMPG = 0x98,
	IFEQ = 0x99, IFNE = 0x9a, IFLT = 0x9b, IFGE = 0x9c, IFGT = 0x9d, IFLE = 0x9e,// BRANCH,
	IF_ICMPEQ = 0x9f, IF_ICMPNE = 0xa0, IF_ICMPLT = 0xa1, IF_ICMPGE = 0xa2, IF_ICMPGT = 0xa3, IF_ICMPLE = 0xa4, IF_ACMPEQ = 0xa5, IF_ACMPNE = 0xa6,// BRANCH,
	GOTO = 0xa7,// BRANCH,
	JSR = 0xa8,// BRANCH,
	RET = 0xa9,// LOCAL,
	TABLESWITCH = 0xaa,// DYNAMIC,
	LOOKUPSWITCH = 0xab,// DYNAMIC,
	IRETURN = 0xac, LRETURN = 0xad, FRETURN = 0xae, DRETURN = 0xaf, ARETURN = 0xb0, RETURN = 0xb1,
	GETSTATIC = 0xb2,// CPREF_W,
	PUTSTATIC = 0xb3,// CPREF_W,
	GETFIELD = 0xb4,// CPREF_W,
	PUTFIELD = 0xb5,// CPREF_W,
	INVOKEVIRTUAL = 0xb6,// CPREF_W,
	INVOKESPECIAL = 0xb7,// CPREF_W,
	INVOKESTATIC = 0xb8,// CPREF_W,
	INVOKEINTERFACE = 0xb9,// CPREF_W_UBYTE_ZERO,
	INVOKEDYNAMIC = 0xba,// CPREF_W_UBYTE_ZERO,
	NEW = 0xbb,// CPREF_W,
	NEWARRAY = 0xbc,// ATYPE,
	ANEWARRAY = 0xbd,// CPREF_W,
	ARRAYLENGTH = 0xbe,
	ATHROW = 0xbf,
	CHECKCAST = 0xc0,// CPREF_W,
	INSTANCEOF = 0xc1,// CPREF_W,
	MONITORENTER = 0xc2,
	MONITOREXIT = 0xc3,
	// wide 0xc4
	MULTIANEWARRAY = 0xc5,// CPREF_W_UBYTE,
	IFNULL = 0xc6,// BRANCH,
	IFNONNULL = 0xc7,// BRANCH,
	GOTO_W = 0xc8,// BRANCH_W,
	JSR_W = 0xc9,// BRANCH_W,
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
		body.binop(node.op);
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
	private maxLocals: number = 0;
	private lines: LineNumberEntry[] = [];
	
	get size() { return this.data.length; }
	
	constructor(private pool: ConstantPool, argCount:number) {
		this.maxLocals = argCount + 1; // this + args
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
			this.data.u8(Opcode.ALOAD_0 + index);
		} else {
			throw 'Not implemented aload XXX';
		}
		this._push(Types.ref('...'));
	}
	
	invokespecial(method:MethodRef) {
		this.data.u8(Opcode.INVOKESPECIAL);
		this.data.u16(method.index);
	}
	
	pushi(value:number) {
		const w = this.data;
		this._push(Types.INT);
		if (value >= -1 && value <= 5) {
			w.u8(Opcode.ICONST_0 + value);
		} else {
			throw 'Not implemented this literal';
		}
	}
	
	binop(op:string) {
		const w = this.data;
		var t1 = this._pop();
		var t2 = this._pop();
		if (t1 != t2) console.warn('Trying to binop different items');
		this._push(t1);
		
		var offset = 0;
		switch (t1) {
			case Types.INT: offset = 0; break;
			case Types.LONG: offset = 1; break;
			case Types.FLOAT: offset = 2; break;
			case Types.DOUBLE: offset = 3; break;
			default: throw 'Unsupported operand';
		}

		switch (op) {
			case '+': w.u8(Opcode.IADD + offset); break;
			case '-': w.u8(Opcode.ISUB + offset); break;
			case '*': w.u8(Opcode.IMUL + offset); break;
			case '/': w.u8(Opcode.IDIV + offset); break;
			case '%': w.u8(Opcode.IREM + offset); break;
			default: throw 'Unknown type 2'; 
		}
		
		switch (t1) {
			case Types.INT:
				break;
			default:
				throw 'Unknown type';
		}
	}
	
	getstatic(fref:FieldRef) {
		const w = this.data;
		this._push(fref.ftype);
		w.u8(Opcode.GETSTATIC);
		w.u16(fref.index);
	}
	
	invokevirtual(mref:MethodRef) {
		const w = this.data;
		// @TODO: fix stack
		w.u8(Opcode.INVOKEVIRTUAL);
		w.u16(mref.index);
	}
	
	ret(type:Type) {
		const w = this.data;
		if (type != Types.VOID) this._pop();
		switch (type) {
			case Types.VOID: w.u8(Opcode.RETURN); break;
			case Types.INT: w.u8(Opcode.IRETURN); break;
			case Types.LONG: w.u8(Opcode.LRETURN); break;
			case Types.FLOAT: w.u8(Opcode.FRETURN); break;
			case Types.DOUBLE: w.u8(Opcode.DRETURN); break;
			default: w.u8(Opcode.ARETURN); break;
		}
	}
	
	private exceptions:ExceptionEntry[] = [];
	private attributes:AttributeInfo[] = [];
	
	toUint8Array() {
		var w = new Writer();
		var code = this.data;
		w.u16(this.maxStack); // max_stack
		w.u16(this.maxLocals); // max_locals
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

class MapCached<K, V> {
	map = new Map<K, V>();
	
	getCache(key:K, cb: () => V) {
		if (!this.map.has(key)) {
			this.map.set(key, cb());
		}
		return this.map.get(key);
	}
}

class ConstantPool {
	entries:ConstantEntry[] = [null];
	strings = new MapCached<string, Utf8>();
	classes = new MapCached<string, ClassInfo>();
	fields = new MapCached<string, FieldRef>();
	methods = new MapCached<string, MethodRef>();
	nameandtypes = new MapCached<string, NameAndTypeInfo>();
	
	_alloc<T extends ConstantEntry>(e:T):T {
		e.index = this.entries.length;
		this.entries.push(e);
		return e;
	}
	
	classInfo(type:RefType):ClassInfo {
		return this.classes.getCache(
			`${type}`,
			() => this._alloc(new ClassInfo(this.str(type.intfqname), type))
		);
	}

	fieldref(clazz:RefType, name:string, type:Type) {
		return this.fields.getCache(
			`${clazz} ${name} ${type}`,
			() => this._alloc(new FieldRef(this.classInfo(clazz), this.nameandtype(name, type), clazz, name, type))
		);
	}

	methodref(clazz:RefType, name:string, type:MethodType) {
		return this.methods.getCache(
			`${clazz} ${name} ${type}`,
			() => this._alloc(new MethodRef(this.classInfo(clazz), this.nameandtype(name, type), clazz, name, type))
		);
	}

	nameandtype(name:string, type:Type) {
		return this.nameandtypes.getCache(
			`${name} ${type}`,
			() => this._alloc(new NameAndTypeInfo(this.str(name), this.str(type.toString())))
		);
	}
	
	str(str:string) {
		return this.strings.getCache(
			str,
			() => this._alloc(new Utf8(str))
		);
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
	constructor(public clazz:ClassInfo, public nameAndType:NameAndTypeInfo, public ref:RefType, public name:string, public method:MethodType) { super(); }
	write(w:Writer) { w.u8(Constant.Methodref); w.u16(this.clazz.index); w.u16(this.nameAndType.index); }
}

class FieldRef extends ConstantEntry {
	constructor(public clazz:ClassInfo, public nameAndType:NameAndTypeInfo, public ref:RefType, public name:string, public ftype:Type) { super(); }
	write(w:Writer) { w.u8(Constant.Fieldref); w.u16(this.clazz.index); w.u16(this.nameAndType.index); }
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
	constructor(public name:Utf8, public ref:RefType) { super(); }
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
	public descriptor: Utf8;
	constructor(public pool:ConstantPool, public accessFlags:MethodAccess, public name:Utf8, public type:MethodType) {
		this.descriptor = this.pool.str(type.toString());
		this.body = new MethodBody(pool, type.args.length);		
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
		var method = new MethodInfo(this.pool, access, this.pool.str(name), type);
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
	const pool = clazz.pool;
	clazz.createField(FieldAccess.PUBLIC | FieldAccess.STATIC, 'test', Types.INT);
	
	var method = clazz.createMethod(MethodAccess.PUBLIC, '<init>', new MethodType([], Types.VOID));
	method.body.line(20);
	method.body.aload(0);
	var initNameAndType = clazz.pool.nameandtype('<init>', new MethodType([], Types.VOID));
	method.body.invokespecial(clazz.pool.methodref(clazz.super_class.ref, '<init>', new MethodType([], Types.VOID)));
	method.body.ret(Types.VOID);

	var method2 = clazz.createMethod(
		MethodAccess.PUBLIC | MethodAccess.STATIC,
		'main', new MethodType([Types.array(Types.STRING)], Types.VOID)
	);
	
	var PrintStream = Types.ref('java.io.PrintStream');
	var System = Types.ref('java.lang.System');
	
	var System_out = pool.fieldref(System, 'out', PrintStream);
	var PrintStream_print_int = pool.methodref(PrintStream, 'print', new MethodType([Types.INT], Types.VOID));
	
	method2.body.getstatic(System_out);
	method2.body.pushi(3);
	method2.body.pushi(2);
	method2.body.binop('+');
	method2.body.invokevirtual(PrintStream_print_int);
		//var initNameAndType = clazz.pool.nameandtype('<init>', new MethodType([], Types.VOID));
	//method2.body.line(33);
	//method2.body.pushi(3);
	method2.body.ret(Types.VOID);

	return clazz.generate();
}

export function generate(module:ir.IrModule) {
	
}
