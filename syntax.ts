///<reference path="./defs.d.ts" />

import { N, NodeList, E, EReg, List, Any, Seq, SetAny, GBase, opt, list, sure, _any } from './grammar';

export function parseInt2(str:string):number {
   return parseInt(str.replace(/_/g, '')); 
}

export class Expr extends N { constructor(e:E, public it:FuncLit1|FuncLit2|AwaitExpr|YieldExpr|BinaryOpList) { super(e); } }
export class Stm extends N { constructor(e:E, public it:any) { super(e); } }
@List(Stm, null, 0) export class Stms extends NodeList { constructor(e:E, public stms:Stm[]) { super(e, stms, null); } }

@EReg(/^(\d+\.\d+|\d*\.\d+|\d+\.[^\.])/) export class Float extends N { }
@EReg(/^\d[\d_]*/) export class Int extends N { get value():number { return parseInt2(this._element.text); } }
@Any('true', 'false') export class Bool extends N { }
@EReg(/^[a-z]\w*/i) export class Id extends N { get text() { return this._element.text; } }
@Any(Bool, Float, Int, Id) export class Literal extends N { constructor(e:E, public item:Bool|Float|Int|Id) { super(e); }}
@Any('++', '--', '+', '-', '!', '~') export class Unop extends N { constructor(e:E, public op:string) { super(e);} }

@Seq('<', list(Id, ',', 1)) export class Generics extends N { constructor(e:E, public ids:Id[], private commas:N[]) { super(e); } }
@Seq(Id, opt(Generics)) export class IdWithGenerics extends N { constructor(e:E, public id:Id, public generics:Generics) { super(e); } }

export var ASSIGN_OPS = ["+=","-=","*=","/=","%=","<<=",">>=",">>>=","|=","&=","^=", "="]; 

@Any(
    '<=>', '===', '!==', '...', 
    '&&', '||', '==', '!=', '..', '<=', '>=', '**', 'is', 'as',
    "+=","-=","*=","/=","%=","<<=",">>=",">>>=","|=","&=","^=", "=",
    '+', '-', '/', '*', '%', '&', '|', '^', '<', '>'
) export class Binop extends N { constructor(e:E) { super(e); } get op() { return this._text; } }

@Seq(Id) export class TypeDecl extends N { constructor(e:E, id:Id) { super(e); } }
@Seq(':', TypeDecl) export class TypeTag extends N { constructor(e:E, public decl:TypeDecl) { super(e); } }

@Any('=>', '=') export class InitType extends N { }
@Seq(InitType, sure(), Expr) export class Init2 extends N { constructor(e:E, public initType:InitType, public expr:Expr) { super(e); } }
@Seq('=', sure(), Expr) export class Init extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq(Id, opt(TypeTag), opt(Init)) export class FuncArg extends N { constructor(e:E, public name:Id, public typetag?:TypeTag, public init?:Init) { super(e); } }
@List(FuncArg, ',', 0) export class FuncArgs extends NodeList { constructor(e:E, public args:FuncArg[]) { super(e, args, null); } }

@Seq('.', Id) export class AccessField extends N { constructor(e:E, public id:Id) { super(e); } }
@Seq('?.', sure(), Id) export class AccessFieldOpt extends N { constructor(e:E, public id:Id) { super(e); } }
@Seq('[', sure(), Expr, ']') export class AccessArray extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('(', sure(), list(Expr, ',', 0), ')') export class AccessCall extends N { constructor(e:E, public exprs:Expr[]) { super(e); } }
@Any('++', '--') export class Postfix extends N { }
@Any(AccessField, AccessFieldOpt, AccessArray, AccessCall, Postfix) export class Access extends N { constructor(e:E, public item:AccessField|AccessFieldOpt|AccessArray|AccessCall|Postfix) { super(e); } }
@Seq(Unop, Expr) export class UnopExpr extends N { constructor(e:E, public unop:Unop, public expr:Expr) { super(e); } }
@Seq('(', Expr, ')') export class ParenExpr extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('(', list(Expr, ',', 0), ')') export class ArrayExpr extends N { constructor(e:E, public items:Expr[]) { super(e); } }
@Any(Literal, UnopExpr, ParenExpr, ArrayExpr) export class Expr1 extends N { constructor(e:E, public it:Literal|UnopExpr|ParenExpr|ArrayExpr) { super(e); } }
@Seq(Expr1, list(Access, null, 0)) export class Expr2 extends N { constructor(e:E, public left:Expr1, public parts:Access[]) { super(e); } }
@List(Expr2, Binop, 1) export class BinaryOpList extends NodeList { constructor(e:E, public expressionsRaw:Expr2[], public operatorsRaw:Binop[]) { super(e, expressionsRaw, operatorsRaw); }  }
@Seq('yield', sure(), Expr) export class YieldExpr extends N { constructor(e:E, public expr:Expr) { super(e); }  }
@Seq('await', sure(), Expr) export class AwaitExpr extends N { constructor(e:E, public expr:Expr) { super(e); }  }
@Seq(Id, '=>', sure(), Expr) export class FuncLit1 extends N { constructor(e:E, public id:Id, public expr:Expr) { super(e); }  }
@Seq('(', FuncArgs, ')', '=>', sure(), Expr) export class FuncLit2 extends N { constructor(e:E, public args:FuncArgs, public expr:Expr) { super(e); }  }

SetAny(Expr, FuncLit2, FuncLit1, AwaitExpr, YieldExpr, BinaryOpList);

@Seq(';') export class EmptyStm extends N { }
@Seq(Expr, ';') export class ExprStm extends N { constructor(e:E, public expr:Expr) { super(e); } }

//@Seq('{', list(Stm, null, 1), '}') export class StmsBlock extends N { constructor(e:E, public stms:Stm[]) { super(e); } }
@Seq('{', Stms, '}') export class StmsBlock extends N { constructor(e:E, public stms:Stms) { super(e); } }

@Seq('else', sure(), Stm) export class Else extends N { constructor(e:E, public codeFalse:Stm) { super(e); } }
class _If extends N { constructor(e:E, public expr:Expr, public codeTrue:Stm, public _else:Else) { super(e); } }
@Seq('static', 'if', sure(), '(', Expr, ')', Stm, opt(Else)) export class StaticIf extends _If { }
@Seq('if', sure(), '(', Expr, ')', Stm, opt(Else)) export class If extends _If { }

@Seq('for', sure(), '(', Id, 'in', Expr, ')', Stm) export class For extends N { constructor(e:E, public id:Id, public expr:Expr, public body:Stm) { super(e); } } 
@Seq('while', sure(), '(', Expr, ')', Stm) export class While extends N { constructor(e:E, public expr:Expr, public code:Stm) { super(e); } }
@Seq('do', sure(), Stm, 'while', '(' , Expr, ')', ';') export class DoWhile extends N { constructor(e:E, public stm:Stm, public expr:Expr) { super(e); } }
@Seq('return', sure(), opt(Expr), ';') export class Return extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('continue', sure(), ';') export class Continue extends N { constructor(e:E) { super(e); } }
@Seq('break', sure(), ';') export class Break extends N { constructor(e:E) { super(e); } }
@Seq('fallthrough', sure(), ';') export class Fallthrough extends N { constructor(e:E) { super(e); } }

@Seq(Id, opt(TypeTag), '=', Expr, ';') export class FieldDecl extends N { constructor(e:E, public name:Id, public optTypeTag:TypeTag, public init:Expr) { super(e); } }
@Any(FieldDecl) export class MemberDecl extends N { constructor(e:E, public it:FieldDecl) { super(e); } }
@Seq('{', sure(), list(MemberDecl, null, 0), '}') export class MemberDecls extends N { constructor(e:E, public members:MemberDecl[]) { super(e); } }

class _ClassType extends N { constructor(e:E, public name:IdWithGenerics, public members:MemberDecls) { super(e); } }
@Seq('class', sure(), IdWithGenerics, MemberDecls) export class ClassType extends _ClassType { }
@Seq('interface', sure(), IdWithGenerics, MemberDecls) export class InterfaceType extends _ClassType { }
@Seq('extension', sure(), IdWithGenerics, MemberDecls) export class ExtensionType extends _ClassType { }
@Seq('enum', sure(), IdWithGenerics, MemberDecls) export class EnumType extends _ClassType { }
@Seq('struct', sure(), IdWithGenerics, '(', ')', MemberDecls) export class StructType extends _ClassType { }
@Seq(Id, opt(TypeTag), opt(Init2)) export class VarDecl extends N { constructor(e:E, public name:Id, public type?:TypeTag, public init?:Init2) { super(e); } }
@Seq(opt('lazy'), 'var', sure(), list(VarDecl, ',', 1), ';') export class Vars extends N { constructor(e:E, public lazy:N, public vars:VarDecl[]) { super(e); } }

@Seq('=>', sure(), Expr, ';') export class FunctionBody1 extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('function', sure(), IdWithGenerics, '(', FuncArgs, ')', opt(TypeTag), _any(FunctionBody1, Stm))
export class Function extends N { constructor(e:E, public name:IdWithGenerics, public args:FuncArgs, public rettype:TypeTag, public body:FunctionBody1|Stm) { super(e); } }

SetAny(Stm,
EmptyStm, StmsBlock, StaticIf, If, For, While, Return, ClassType, InterfaceType, ExtensionType,
EnumType, Vars, Function, Continue, Break, Fallthrough, ExprStm
);
