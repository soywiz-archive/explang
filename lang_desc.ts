///<reference path="./defs.d.ts" />

import { N, NodeList, E, EReg, List, Any, Seq, SetAny, GBase, list, sure } from './lang_desc2';

export function parseInt2(str:string):number {
   return parseInt(str.replace(/_/g, '')); 
}

@EReg(/^(\d+\.\d+|\d*\.\d+|\d+\.[^\.])/) export class Float extends N { }
@EReg(/^\d[\d_]*/) export class Int extends N { get value():number { return parseInt2(this.element.text); } }
@Any('true', 'false') export class Bool extends N { }
@EReg(/^[a-z]\w*/i) export class Id extends N { }
@Any(Bool, Float, Int, Id) export class Literal extends N { constructor(e:E, public item:Bool|Float|Int|Id) { super(e); }}
@Any('++', '--', '+', '-', '!', '~') export class Unop extends N { constructor(e:E, public op:string) { super(e);} }


@Any(
    '<=>', '===', '!==', '...', 
    '&&', '||', '==', '!=', '..', '<=', '>=', '**', 'is', 'as',
    "+=","-=","*=","/=","%=","<<=",">>=",">>>=","|=","&=","^=",
    "=", '+', '-', '/', '*', '%', '&', '|', '^', '<', '>'
) export class Binop extends N { constructor(e:E, public op:string) { super(e);} }

export class Expr extends N { constructor(e:E, public it:FuncLit1|FuncLit2|AwaitExpr|YieldExpr|BinaryOpList) { super(e); } }

@Seq(Id) export class FuncArg extends N { constructor(e:E, public id:Id) { super(e); } }
@List(FuncArg, ',', 0) export class FuncArgs extends NodeList { }

@Seq('.', sure(), Id) export class AccessField extends N { constructor(e:E, public id:Id) { super(e); } }
@Seq('?.', sure(), Id) export class AccessFieldOpt extends N { constructor(e:E, public id:Id) { super(e); } }
@Seq('[', sure(), Expr, ']') export class AccessArray extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('(', sure(), list(Expr, ',', 0), ')') export class AccessCall extends N { constructor(e:E, public exprs:Expr[]) { super(e); } }
@Any(AccessField, AccessFieldOpt, AccessArray, AccessCall, '++', '--') export class Access extends N { constructor(e:E, public item:AccessField|AccessFieldOpt|AccessArray|AccessCall|string) { super(e); } }
@Seq(Unop, Expr) export class UnopExpr extends N { constructor(e:E, public unop:Unop, public expr:Expr) { super(e); } }
@Seq('(', Expr, ')') export class ParenExpr extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('(', list(Expr, ',', 0), ')') export class ArrayExpr extends N { constructor(e:E, public items:Expr[]) { super(e); } }
@Any(Literal, UnopExpr, ParenExpr, ArrayExpr) export class Expr1 extends N { constructor(e:E, public it:Literal|UnopExpr|ParenExpr|ArrayExpr) { super(e); } }
@Seq(Expr1, list(Access, null, 0)) export class CallOrArrayAccess extends N { constructor(e:E, public expr:Expr1, public parts:Access[]) { super(e); } }
@Any(CallOrArrayAccess) export class Expr2 extends N { constructor(e:E, public it:CallOrArrayAccess) { super(e); }  }
@List(Expr2, Binop, 1) export class BinaryOpList extends N { constructor(e:E, public exprs:Expr2[], public ops:string[]) { super(e); }  }
@Seq('yield', sure(), Expr) export class YieldExpr extends N { constructor(e:E, public expr:Expr) { super(e); }  }
@Seq('await', sure(), Expr) export class AwaitExpr extends N { constructor(e:E, public expr:Expr) { super(e); }  }
@Seq(Id, '=>', sure(), Expr) export class FuncLit1 extends N { constructor(e:E, public id:Id, public expr:Expr) { super(e); }  }
@Seq('(', FuncArgs, ')', '=>', sure(), Expr) export class FuncLit2 extends N { constructor(e:E, public args:FuncArgs, public expr:Expr) { super(e); }  }

//@Seq(Id, '=>', sure(), Expr)
//export class FuncLit2 extends PsiNode { constructor(e:E, public id:Id, public expr:Expr) { super(e); }  }

//(<AccessCall>null).exprs[0].it

class Stm extends N {
}

SetAny(Expr, FuncLit1, FuncLit2, AwaitExpr, YieldExpr, BinaryOpList);

/*
@Any(Id)
class Expr extends PsiNode { constructor(e:E, public item:Id | Id | Id) { super(e); } }



console.log((<any>For).test);
console.log(new For(null, null, null, null));
*/

@Seq('for', sure(), '(', Id, 'in', Expr, ')', Stm)
export class For extends N { constructor(e:E, public id:Id, public expr:Expr, public stm:Stm) { super(e) } }

@Any(/^\d+/) export class Demo1 extends N { }
@Seq(Demo1, '+', Demo1) export class Demo2 extends N { constructor(e:E, public a:Demo1, public b:Demo1) { super(e); } }
