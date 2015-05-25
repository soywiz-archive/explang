import {
	Node, BinOpNode, ReturnNode,
	IrModule,
	IrClass,
	VoidType, IntType, LongType, FloatType, DoubleType
} from './ir_ast';

import { Writer } from './utils';

enum Constant {
	Utf8 = 1, Integer = 3, Float = 4, Long = 5,
	Double = 6, Class = 7, String = 8, Fieldref = 9,
	Methodref = 10, InterfaceMethodref = 11, NameAndType = 12,
}

enum Opcode {
	nop = 0x0,
	aconst_null = 0x1,
	iconst_m1 = 0x2, iconst_0 = 0x3, iconst_1 = 0x4, iconst_2 = 0x5, iconst_3 = 0x6, iconst_4 = 0x7, iconst_5 = 0x8,
	lconst_0 = 0x9, lconst_1 = 0xa,
	fconst_0 = 0xb, fconst_1 = 0xc, fconst_2 = 0xd,
	dconst_0 = 0xe, dconst_1 = 0xf,
	
	// ....
	
	iadd = 0x60, ladd = 0x61, fadd = 0x62, dadd = 0x63,
	isub = 0x64, lsub = 0x65, fsub = 0x66, dsub = 0x67,
	
	// ....
	ireturn	= 0xac, lreturn = 0xad, freturn = 0xae, dreturn = 0xaf, areturn = 0xb0, 'return' = 0xb1,
}

class BodyContext {
	public writer:Writer;
}

function genbody(context:BodyContext, node:Node) {
	var writer = context.writer;
	if (node == null) throw 'Node must not be null';
	if (node instanceof BinOpNode) {
		genbody(context, node.l);
		genbody(context, node.r);
		switch (node.type) {
			case IntType:
				switch (node.op) {
					case '+': writer.i8(Opcode.iadd); break;
					case '-': writer.i8(Opcode.isub); break;
					default: throw 'Not implemented!';
				}
			break;
			default: throw `Not implemented type ${node.type}!`;
		}
	} else if (node instanceof ReturnNode) {
		if (node.type != VoidType) genbody(context, node.optValue);
		switch (node.type) {
			case VoidType: writer.i8(Opcode['return']); break;
			case IntType: writer.i8(Opcode.ireturn); break;
			case LongType: writer.i8(Opcode.lreturn); break;
			case FloatType: writer.i8(Opcode.freturn); break;
			case DoubleType: writer.i8(Opcode.dreturn); break;
			default: writer.i8(Opcode.areturn); break;
		}
	} else {
		throw `Not implemented node ${node}!`;
	}
}

function genclass() {
	// https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html
	var writer = new Writer();
	writer.i32(0xCAFEBABE); // magic
	writer.i16(0); // minor
	writer.i16(6); // major
	writer.i16(0); // constant_pool_count
}

export function generate(module:IrModule) {
	
}
