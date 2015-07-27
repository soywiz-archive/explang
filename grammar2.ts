import grammar = require('./grammar');
import { PsiElement, PsiNode, ReaderContext } from './grammar';
import { classNameOf } from './utils';

export type E = grammar.PsiElement;

const DEBUG = false;

export function newVariadic(t:Class<any>, v:any[]) {
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

export class N {
    public complete:boolean = false;
    constructor(public element:PsiElement) { }
    get nodeType() { return (<any>this.constructor).name; }
    static build(t:Class<N>, args:any[], complete:boolean) {
        if (t == null) t = UnmatchedNode;
        if (DEBUG) console.info('N.build', classNameOf(t), args.length);
        let node:N = newVariadic(t, args);
        node.complete = complete;
        return node;
    }
    toString() {
        let out = (<any>this.constructor).name + '["' + this.element.text + '"]';
        for (let i in this) {
            let v = (<any>this)[i];
            if ((v instanceof N) || (v instanceof Array)) {
                out += '(' + i + '=' + v + ')';
            }
        }
        return out;
    }
}

export class NodeList extends N {
    constructor(e:E, public elements:N[], public separators:N[]) { super(e); }
}

export class UnmatchedNode extends N { }

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
        if (DEBUG) console.log('matched', reason);
        return new GrammarResult(true, node);
    }
    
    private static _unmatched:GrammarResult = new GrammarResult(false, null); 
    static unmatched(reason:string) {
        if (DEBUG) console.log('unmatched:', reason);
        return this._unmatched;
    }
}

export class GBase {
    public constructor(public clazz:Class<N>) { }
    
    protected build(context:ReaderContext, result:grammar.TRange, children:PsiElement[], nodes:any[], complete:boolean):N {
        if (result == null) return null;
        const element = context.createBasePsi(children, result);
        var args:any[] = [];
        args.push(element);
        for (let node of nodes) args.push(node);
        return N.build(this.clazz, args, complete);
    }

	match(readerContext:ReaderContext):N {
        throw "Must override match";
    }
    
    toString() { return classNameOf(this); }
}

export class GRegExp extends GBase {
	public constructor(public reg:RegExp, clazz:Class<N> = null) { super(clazz); }

	match(context:ReaderContext):N {
        context.skip();
        let result = context.reader.matchERegRange(this.reg);
        if (DEBUG) console.log(`GRegExp.match: ${this.reg} :: ${result}`);
        return result ? this.build(context, result, [], [], true) : null;
    }
    
    toString() { return `${this.reg}`; }
}

export class GLiteral extends GBase {
	public constructor(public lit:string) { super(null); }

	match(context:ReaderContext):N {
        context.skip();
        let result = context.reader.matchLitRange(this.lit);
        if (DEBUG) console.log('GLiteral.match', this.lit, result);
        return result ? this.build(context, result, [], [], true) : null;
    }
    
    toString() { return `${this.lit}`; }
}

export class GLiteralList extends GBase {
    private litsOpt:grammar.Literals;
	public constructor(clazz:Class<N>, public lits:string[]) {
        super(clazz);
        this.litsOpt = grammar.Literals.fromList(lits);
    }

	match(context:ReaderContext):N {
        context.skip();
        if (DEBUG) console.log('pos', context.reader.pos);
        let result = context.reader.matchLitListRange(this.litsOpt);
        if (DEBUG) console.log('GLiteralList.match', `${this.litsOpt}`, `${result}`);
        return this.build(context, result, [], [], true);
    }
    
    toString() { return `${this.litsOpt}`; }
}

export class GBaseInfo {
    constructor(public m:GBase, public store:boolean) { }
    toString() { return `${this.m}`; }
    static fromARG(item:ARG):GBaseInfo {
        //if (!(item instanceof GBaseInfo)) throw new Error('Not a GBaseInfo');
        if (item instanceof GBaseInfo) return <GBaseInfo>item;
        if (item instanceof GBase) return new GBaseInfo(item, true);
        if (typeof item == 'string') return new GBaseInfo(new GLiteral(<string>item), false);
        if (item instanceof RegExp) return new GBaseInfo(new GRegExp(item), false);
        //console.log(typeof item);
        let matcher = (<any>item).matcher;
        if (!matcher) throw new Error("Not matcher found in " + item);
        return new GBaseInfo(matcher, true);
    }
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
            let i = GBaseInfo.fromARG(item);
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
        let complete = false;
        
        if (DEBUG) console.log('' + this);
        
        for (const item of this.items) {
            reader.pos = start;
            const node = item.m.match(context);
            if (DEBUG) console.log(`any -> ${node}`);
            if (node != null) {
                if (result == null || node.complete) {
                    result = node;
                    if (node.complete) {
                        complete = true;
                        break;
                    }
                }
            }
        }
        const end = reader.pos;
        
        if (result != null) {        
            return this.build(context, reader.createRange(start, end), [result.element], [result], complete);
        } else {
            return null;
        }
    }
    
    toString() { this.prepareOnce(); return '[' + this.items.join('|') + ']'; }
}

export class GSure extends GBase { }

export class GList extends GBase {
    private prepared:boolean = false;
    public elementInfo:GBaseInfo;
    public separatorInfo:GBaseInfo;
    
    constructor(clazz:Class<N>, public element:Class<N>, public separator:ARG, public min:number, public tailsep:boolean = false) {
        super(clazz);
    }
    
    private prepareOnce() {
        if (this.prepared) return;
        this.prepared = true;
        this.elementInfo = GBaseInfo.fromARG(this.element);
        this.separatorInfo = this.separator ? GBaseInfo.fromARG(this.separator) : null;
    }
    
    match(context:ReaderContext):NodeList {
        let reader = context.reader;
        let items:N[] = [];
        let separators:N[] = [];
        let children:E[] = [];
        
        this.prepareOnce();
        
        let start = reader.pos;
        let complete = true;
        while (true) {
            let it = this.elementInfo.m.match(context);
            if (DEBUG) console.log('result:' + it);
            
            if (it == null) {
                if (DEBUG) console.log('it break');
                break;
            } else {
                if (it != null) children.push(it.element);
                items.push(it);
            }

            let sep:N = null;
            if (this.separatorInfo != null) {
                sep = this.separatorInfo.m.match(context);
                if (sep == null) {
                    if (DEBUG) console.log('sep break');
                    break;
                } else {
                    separators.push(sep);
                }
            }
        }
        let end = reader.pos;
        if (DEBUG) console.log('items:', items.length, items);
        if (DEBUG) console.log('separators:', separators.length, separators);
        
        if (items.length < this.min) return null;
        
        return <NodeList>this.build(context, reader.createRange(start, end), children, [items, separators], true);
    }
}

export class GSeq extends GSeqAny {
    toString() { this.prepareOnce(); return '(' + this.items.join(',') + ')'; }
    
	match(context:ReaderContext):N {
        const reader = context.reader; 
        this.prepareOnce();
        context.skip();
        const all:N[] = [];
        const elements:PsiElement[] = [];
        const out:any[] = [];
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
            if (item.store) {
                if (node instanceof NodeList) {
                    if (m instanceof GList) {
                        //console.log('aaaaaaaaaaaaaaa', classNameOf(node.elements), classNameOf(node.separators));
                        out.push(node.elements);
                        if (m.separator != null) {
                            out.push(node.separators);
                        }
                    } else {
                        throw 'NodeList but no GList';
                    }
                } else {
                    out.push(node);
                }
            }
            if (node == null) {
                complete = false;
                break;
            }
        }
        //console.log(classNameOf(this.clazz), out.map(classNameOf));
        const end = reader.pos;
        
        if (!complete && !sure) {
            reader.pos = start;
            return null;
        } else {
            const result = this.build(context, reader.createRange(start, end), elements, out, complete);
            //if (classNameOf(this.clazz) == 'CallOrArrayAccess') console.log(result.nodeType, result);
            for (const item of all) if (item && item.element && item.element.node == null) item.element.node = result; 
            result.complete = complete;
            return result;
        }
    }
}

export type ARG = string|RegExp|Class<N>|GBase;

export function Seq(...args:ARG[]) {
	return function (target: Class<N>) {
		(<any>target).matcher = new GSeq(target, args);
	}
}

export function SetAny(target: Class<N>, ...args:ARG[]) {
    let allStrings = (args.filter(args => typeof args != 'string').length == 0);
	(<any>target).matcher = allStrings ? new GLiteralList(target, <string[]>args) : new GAny(target, args);
}

export function Any(...args:ARG[]) {
	return function (target: Class<N>) {
        SetAny(target, ...args);
	}
}

export function EReg(reg:RegExp) {
	return function (target: Class<N>) {
        (<any>target).matcher = new GRegExp(reg, target);
        //SetAny(target, reg);
	}
}

export function List(element:Class<N>, separator:ARG, min:number) {
	return function (target: Class<N>) {
        (<any>target).matcher = new GList(target, element, separator, min);
	}
}

export function sure() { return new GSure(null); }

export function list(element:Class<N>, separator:ARG, min:number):GList {
    return new GList(NodeList, element, separator, min);
}

export function match2<T extends N>(e:GBase, str:string, file?:string, pos?:number):T {
    return <T>e.match(new ReaderContext(new grammar.Reader(str, file, pos)));
}
export function match<T extends N>(e:Class<T>, str:string, file?:string, pos?:number):T {
    return match2<T>(<GBase>(<any>e).matcher, str, file, pos);
}
