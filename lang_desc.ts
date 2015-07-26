///<reference path="./defs.d.ts" />

import grammar = require('./grammar');
import { PsiElement, PsiNode, ReaderContext } from './grammar';
import { classNameOf } from './utils';

function newVariadic(t:Class<any>, v:any[]) {
    switch (v.length) {
        case 0: return new t();
        case 1: return new t(v[0]);
        case 2: return new t(v[0], v[1]);
        case 3: return new t(v[0], v[1], v[2]);
        case 4: return new t(v[0], v[1], v[2], v[3]);
        case 5: return new t(v[0], v[1], v[2], v[3], v[4]);
        case 6: return new t(v[0], v[1], v[2], v[3], v[4], v[5]);
        case 7: return new t(v[0], v[1], v[2], v[3], v[4], v[5], v[6]);
        case 8: return new t(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
        case 9: return new t(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8]);
        default: throw new Error("Can't create an object with that many arguments");
    }
}

class N {
    public complete:boolean;
    constructor(public element:PsiElement) { }
    static build(t:Class<N>, args:any[]) {
        if (t == null) t = UnmatchedNode;
        //console.info('N.build', classNameOf(t), args.length);
        return newVariadic(t, args);
    }
    toString() { return (<any>this.constructor).name + '(' + this.element + ')'; }
}

class UnmatchedNode extends N { }

type E = grammar.PsiElement;

export class GrammarResult {
    public name:string = null;
    public endOfFile:boolean = false;
    public constructor(public matched:Boolean, public node:PsiElement) {
    }
    get text() {
        if (this.node == null) return '';
        return this.node.text;
    }
    toString() {
        return this.text;
    }
    static matched(reason:string, node:PsiElement) {
        //console.log('matched', reason);
        return new GrammarResult(true, node);
    }
    
    private static _unmatched:GrammarResult = new GrammarResult(false, null); 
    static unmatched(reason:string) {
        //console.log('unmatched:', reason);
        return this._unmatched;
    }
}

class GBase {
    public constructor(public clazz:Class<N>) { }
    
    protected build(context:ReaderContext, result:grammar.TRange, children:PsiElement[], nodes:N[]):N {
        const element = context.createBasePsi(children, result);
        var args:any[] = [];
        args.push(element);
        for (let node of nodes) args.push(node);
        return result ? N.build(this.clazz, args) : null;
    }

    protected transform(item:any):GBaseInfo {
        //if (!(item instanceof GBaseInfo)) throw new Error('Not a GBaseInfo');
        if (item instanceof GBaseInfo) return item;
        if (item instanceof GBase) return new GBaseInfo(item, true);
        if (typeof item == 'string') return new GBaseInfo(new GLiteral(item), false);
        if (item instanceof RegExp) return new GBaseInfo(new GRegExp(item), false);
        //console.log(typeof item);
        let matcher = (<any>item).matcher;
        if (!matcher) throw new Error("Not matcher found in " + item);
        return new GBaseInfo(matcher, true);
    }
        
	match(readerContext:ReaderContext):N {
        throw "Must override match";
    }
}

export class GRegExp extends GBase {
	public constructor(public value:RegExp) { super(null); }

	match(context:ReaderContext):N {
        context.skip();
        return this.build(context, context.reader.matchERegRange(this.value), [], []);
    }
}

export class GLiteral extends GBase {
	public constructor(public value:string) { super(null); }

	match(context:ReaderContext):N {
        context.skip();
        return this.build(context, context.reader.matchLitRange(this.value), [], []);
    }
}

export class GBaseInfo {
    constructor(public m:GBase, public store:boolean) { }
}

export class GSeqAny extends GBase {
    protected items:GBaseInfo[] = null;
    protected paramcount = 0;

	public constructor(clazz:Class<N>, public rawItems:any[]) { super(clazz); }

    protected prepareOnce() {
        if (this.items != null) return;
        var out:GBaseInfo[] = [];
        this.paramcount = 0;
        for (let item of this.rawItems) {
            let i = this.transform(item);
            out.push(i);
            if (i.store) this.paramcount++;
        }
        this.items = out;
    }
}

export class GAny extends GSeqAny {
	match(context:ReaderContext):N {
        const reader = context.reader; 
        this.prepareOnce();
        context.skip();
        const start = reader.pos;
        let result:N = null;
        
        for (const item of this.items) {
            reader.pos = start;
            const node = item.m.match(context);
            if (node != null) {
                if (result == null || node.complete) {
                    result = node;
                    if (node.complete) break;
                }
            }
        }
        const end = reader.pos;
        
        if (result != null) {        
            return this.build(context, reader.createRange(start, end), [result.element], [result]);
        } else {
            return null;
        }
    }
}

export class GSure extends GBase { }

export class GSeq extends GSeqAny {
	match(context:ReaderContext):N {
        const reader = context.reader; 
        this.prepareOnce();
        context.skip();
        const all:N[] = [];
        const elements:PsiElement[] = [];
        const out:N[] = [];
        let complete = true;
        const start = reader.pos;
        let sure = false;
        for (let item of this.items) {
            let m = item.m;
            if (m instanceof GSure) {
                sure = true;
                continue;
            }
            let node = item.m.match(context);
            all.push(node);
            if (node != null) elements.push(node.element);
            if (item.store) out.push(node);
            if (node == null) {
                complete = false;
                break;
            }
        }
        const end = reader.pos;
        
        const result = this.build(context, reader.createRange(start, end), elements, out);
        for (const item of all) if (item.element.node == null) item.element.node = result; 
        result.complete = complete;
        return result;
    }
}

type ARG = string|RegExp|Class<N>|GBase;

function Seq(...args:ARG[]) {
	return function (target: Class<N>) {
		(<any>target).matcher = new GSeq(target, args);
	}
}

function SetAny(target: Class<N>, ...args:ARG[]) {
	(<any>target).matcher = new GAny(target, args);
}

function Any(...args:ARG[]) {
	return function (target: Class<N>) {
        SetAny(target, ...args);
	}
}

function sure() { return new GSure(null); }
function list(...a:any[]) { return '$LIST'; }

@Any(/^(\d+\.\d+|\d*\.\d+|\d+\.[^\.])/) export class Float extends N { }
@Any(/^\d[\d_]*/) export class Int extends N { }
@Any('true', 'false') export class Bool extends N { }
@Any(/^[a-z]\w*/i) export class Id extends N { }
@Any(Bool, Float, Int, Id) export class Literal extends N { constructor(e:E, public item:Bool|Float|Int|Id) { super(e); }}
@Any(
	'++', '--',
	'+', '-', '!', '~'
) export class Unop extends N { constructor(e:E, public op:string) { super(e);} }

@Any(
    '<=>', '===', '!==', '...', 
    '&&', '||', '==', '!=', '..', '<=', '>=', '**', 'is', 'as',
    "+=","-=","*=","/=","%=","<<=",">>=",">>>=","|=","&=","^=",
    "=", '+', '-', '/', '*', '%', '&', '|', '^', '<', '>'
) export class Binop extends N { constructor(e:E, public op:string) { super(e);} }

export class Expr extends PsiNode { constructor(e:E, public it:FuncLit1|FuncLit2|AwaitExpr|YieldExpr|BinaryOpList) { super(e); } }

@Seq(Id) export class FuncArg extends N { constructor(e:E, public id:Id) { super(e); } }
@Any(list(FuncArg, ',', 0)) export class FuncArgs extends N { }

@Seq('.', sure(), Id) export class AccessField extends N { constructor(e:E, public id:Id) { super(e); } }
@Seq('?.', sure(), Id) export class AccessFieldOpt extends N { constructor(e:E, public id:Id) { super(e); } }
@Seq('[', sure(), Expr, ']') export class AccessArray extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('(', sure(), list(Expr, ','), ')') export class AccessCall extends N { constructor(e:E, public exprs:Expr[]) { super(e); } }
@Any(AccessField, AccessFieldOpt, AccessArray, AccessCall, '++', '--') export class Access extends N { constructor(e:E, public item:AccessField|AccessFieldOpt|AccessArray|AccessCall|string) { super(e); } }
@Seq(Unop, Expr) export class UnopExpr extends N { constructor(e:E, public unop:Unop, public expr:Expr) { super(e); } }
@Seq('(', Expr, ')') export class ParenExpr extends N { constructor(e:E, public expr:Expr) { super(e); } }
@Seq('(', list(Expr, ',', 0), ')') export class ArrayExpr extends N { constructor(e:E, public items:Expr[]) { super(e); } }
@Any(Literal, UnopExpr, ParenExpr, ArrayExpr) export class Expr1 extends N { constructor(e:E, public it:Literal|UnopExpr|ParenExpr|ArrayExpr) { super(e); } }
@Seq(Expr1, list(Access, null, 0)) export class CallOrArrayAccess extends N { constructor(e:E, expr:Expr1, parts:Access[]) { super(e); } }
@Any(CallOrArrayAccess) export class Expr2 extends N { constructor(e:E, public it:CallOrArrayAccess) { super(e); }  }
@Any(list(Expr2, Binop, 1)) export class BinaryOpList extends N { constructor(e:E, public exprs:Expr2[], public ops:string[]) { super(e); }  }
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

export function match<T extends N>(e:Class<T>, str:string, file?:string, pos?:number):T {
    return <T>(<GBase>(<any>e).matcher).match(new ReaderContext(new grammar.Reader(str, file, pos)));
}
