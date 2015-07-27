import { classNameOf } from './utils';

export class TRange {
    public constructor(public min:number, public max:number, public reader:Reader) { }
    static combine(a:TRange, b:TRange):TRange {
        return new TRange(Math.min(a.min, b.min), Math.max(a.max, b.max), a.reader);
    }
    static combineList(list:TRange[]):TRange {
        if (!list || list.length == 0) return null;
        var first = list[0];
        var min = first.min;
        var max = first.max;
        for (var i of list) {
            min = Math.min(min, i.min);
            max = Math.max(max, i.max);
        }
        return new TRange(min, max, first.reader);
    }
    public contains(index:number) { return index >= this.min && index <= this.max; }
    public toString() { return `${this.min}:${this.max}`; }
    public get file():string { return this.reader.file; }
    public get text():string { return this.reader.slice(this.min, this.max); }
    
    public startEmptyRange():TRange {
        return new TRange(this.min, this.min, this.reader);
    }

    public endEmptyRange():TRange {
        return new TRange(this.max, this.max, this.reader);
    }

    public displace(offset:number):TRange {
        return new TRange(this.min + offset, this.max + offset, this.reader);
    }

    static createDummy() {
        return new TRange(0, 0, new Reader(''));
    }
}

function arrayUnique<T>(a:T[]) {
    return a.reduce(function(p, c) {
        if (p.indexOf(c) < 0) p.push(c);
        return p;
    }, []);
};

export class Literals {
    constructor(private lits:string[], private map:StringDictionary<boolean>, public lengths:number[]) { }
    
    contains(lit:string) { 
        return typeof this.map[lit] !== "undefined";
    }
    
    static fromList(lits:string[]):Literals {
        var lengths = arrayUnique(lits.map(v => v.length)).sort().reverse();
        let map:StringDictionary<boolean> = {};
        for (let lit of lits) map[lit] = true;
        return new Literals(lits, map, lengths);
    }
    
    toString() { return `Literals(${this.lits.join(' ')})`; }
}

export class Reader {
    public constructor(public str:string, public file:string = 'file', public pos = 0) {
    }
    
    public reset() {
        this.pos = 0;
    }
    
    public get eof() {
        return this.pos >= this.str.length;
    }

    public createRange(start:number = -1, end:number = -1):TRange {
        if (start == -1) start = this.pos;
        if (end == -1) end = this.pos;
        return new TRange(start, end, this);
    }

    public readRange(length:number):TRange {
        var range = new TRange(this.pos, this.pos + length, this);
        this.pos += length;
        return range;
    }
    
    public slice(start:number, end:number):string {
        return this.str.substr(start, end - start);
    }

    public peek(count:number):string {
        return this.str.substr(this.pos, count);
    }

    public peekChar():number {
        return this.str.charCodeAt(this.pos);
    }

    public read(count:number):string {
        var out = this.peek(count);
        this.skip(count);
        return out;
    }

    public unread(count:number):void {
        this.pos -= count;
    }
    public readChar():number {
        var out = this.peekChar();
        this.skip(1);
        return out;
    }

    public skip(count:number):void {
        this.pos += count;
    }

    public matchLit(lit:string) {
        if (this.str.substr(this.pos, lit.length) != lit) return null;
        this.pos += lit.length;
        return lit;
    }

    public matchLitRange(lit:string):TRange {
        return (this.str.substr(this.pos, lit.length) == lit) ? this.readRange(lit.length) : null;
    }

    public matchLitListRange(lits:Literals):TRange {
        for (let len of lits.lengths) {
            if (lits.contains(this.str.substr(this.pos, len))) {
                return this.readRange(len);
            }
        }
        return null;
    }

    public matchEReg(v:RegExp) {
		var result = this.str.substr(this.pos).match(v);
        if (!result) return null;
        var m = result[0];
        this.pos += m.length;
        return m;
    }

    public matchERegRange(v:RegExp):TRange {
		var result = this.str.substr(this.pos).match(v);
        if (!result) return null;
        return this.readRange(result[0].length);
    }

    public matchStartEnd(start:string, end:string):string {
        if (this.str.substr(this.pos, start.length) != start) return null;
        var startIndex = this.pos;
        var index = this.str.indexOf(end, this.pos);
        if (index < 0) return null;
        //trace(index);
        this.pos = index + end.length;
        return this.slice(startIndex, this.pos);
    }
}

type Skipper = (readerContext:ReaderContext) => void;

export class ReaderContext {
    skipperStack:Skipper[] = [];
    skipper:Skipper;
    public file:PsiFile;
    public constructor(public reader:Reader) {
        this.file = new PsiFile(reader);
        this.pushSkipper(context => {
            context.reader.matchEReg(/^\s+/);
        });
    }
    createBasePsi(children:PsiElement[] = [], range?:TRange):PsiElement {
        if (range == null) range = this.reader.createRange();
        return new PsiElement(this.file, range, children);
    }
    createEmptyPsi<T extends PsiElement>(clazz:Class<T>, range?:TRange):T {
        if (range == null) range = this.reader.createRange();
        return PsiElement.create(clazz, this.file, range, []);
    }
    createPsi<T extends PsiElement>(clazz:Class<T>, elements:T[]):T {
        var range:TRange;
        if (elements.length > 0) {
            range = TRange.combineList(elements.map(e => e.range));
        } else {
            range = this.reader.createRange();
        }
        return PsiElement.create(clazz, this.file, range, elements);
    }
    skip() {
        this.skipper(this);
    }
    pushSkipper(skipper: Skipper) {
        this.skipperStack.push(this.skipper = skipper);
    }
    popSkipper() {
        this.skipper = this.skipperStack.pop();
    }
}

export class Language {
    public constructor(public name:string) {
    }
    static EXP = new Language('exp');
}

export class PsiFile {
    constructor(public reader:Reader) {
    }    
}

export class Key<T> { constructor(public name:string) { } }

export class PsiElement {
    public language:Language = Language.EXP;
    public parent:PsiElement;
    public node:N;
    
    toString() { return 'PsiElement(' + this.range + ' : ' + this.text + ' : ' +  this.children.length + ')'; }

    constructor(public file:PsiFile, public range:TRange, public children:PsiElement[] = []) {
        for (let child of children) {
            child.parent = this;
        }
    }
    
    setUserData<T>(key:Key<T>, value:T) {
    }

    getUserData<T>(key:Key<T>):T {
        return null;
    }

    get root():PsiElement {
        return this.parent ? this.parent.root : this;
    }
    
    static create<T extends PsiElement>(clazz:Class<T>, file:PsiFile, range:TRange, children:PsiElement[] = []):T {
        return new clazz(file, range, children);
    }

    get type() {
        if (this.node != null) return '' + (<any>this.node.constructor).name;
        return '' + (<any>this.constructor).name;
    }
    
    get text() { return this.range.text; }
    
    getChildrenOfType<T>(clazz:Class<T>):T[] {
        return <T[]><any[]>this.children.filter(c => c instanceof clazz);
    }
    
    get first() { return this.children.length ? this.children[0] : null; }
    get last() { return this.children.length ? this.children[this.children.length - 1] : null; }
 
    as<T extends PsiElement>(clazz:Class<T>) {
        return <T>this;
    }
    
    dump(pad:string = '') {
        console.log(pad + this.type + ': ' + this.text);
        for (let child of this.children) {
            child.dump(pad + '  ');
        }
    }
}

export type E = PsiElement;

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
    public _complete:boolean = false;
    constructor(public _element:PsiElement) { }
    get _text() { return this._element.text; }
    get _nodeType() { return (<any>this.constructor).name; }
    static build(t:Class<N>, args:any[], complete:boolean) {
        if (t == null) t = UnmatchedNode;
        if (DEBUG) console.info('N.build', classNameOf(t), args.length);
        let node:N = newVariadic(t, args);
        node._complete = complete;
        return node;
    }
    toString() {
        let out = (<any>this.constructor).name + '["' + this._element.text + '"]';
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

class AnonymousList extends NodeList { }
class AnonymousAny extends N { constructor(e:E, public it:N) { super(e); } }

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
    
    protected build(context:ReaderContext, result:TRange, children:PsiElement[], nodes:any[], complete:boolean):N {
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
    private litsOpt:Literals;
	public constructor(clazz:Class<N>, public lits:string[]) {
        super(clazz);
        this.litsOpt = Literals.fromList(lits);
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
        if (item === null) return null;
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
                if (result == null || node._complete) {
                    result = node;
                    if (node._complete) {
                        complete = true;
                        break;
                    }
                }
            }
        }
        const end = reader.pos;
        
        if (result != null) {        
            return this.build(context, reader.createRange(start, end), [result._element], [result], complete);
        } else {
            return null;
        }
    }
    
    toString() { this.prepareOnce(); return '[' + this.items.join('|') + ']'; }
}

export class GSure extends GBase { }

export class GOptional extends GBase {
    private elementInfo:GBaseInfo = null;
    
    constructor(public element:ARG) {
        super(null);
    }
    
    match(context:ReaderContext):N {
        if (!this.elementInfo) this.elementInfo = GBaseInfo.fromARG(this.element);
        let reader = context.reader;
        let result = this.elementInfo.m.match(context);
        let clazz = this.elementInfo.m.clazz;
        this.clazz = clazz;
        if (result == null) {
            result = this.build(context, reader.readRange(0), [], [], true); 
        }
        return result;
    }
}

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
                if (it != null) children.push(it._element);
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
            if (node != null) {
                elements.push(node._element);
                if (node instanceof AnonymousAny) {
                    node = (<AnonymousAny>node).it;
                }
            }
            if (item.store) {
                if (node instanceof AnonymousList) {
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
            for (const item of all) if (item && item._element && item._element.node == null) item._element.node = result; 
            result._complete = complete;
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
	return function (target: Class<NodeList>) {
        (<any>target).matcher = new GList(target, element, separator, min);
	}
}

export function sure() { return new GSure(null); }

export function list(element:Class<N>, separator:ARG, min:number):GList {
    return new GList(AnonymousList, element, separator, min);
}

export function opt(arg:ARG):GOptional {
    return new GOptional(arg);
}

export function _any(...args:ARG[]):GAny {
    return new GAny(AnonymousAny, args);
}

export class MatchResult<T extends N> {
    constructor(public node:T, public context:ReaderContext) {
    }
    get matched() { return this.node._complete; }
    get eof() { return this.context.reader.eof; }
    get text() { return this.node ? this.node._element.text : '<unmatched>'; }
    get nodeType() { return this.node ? this.node._nodeType : null; }
}

export function match2<T extends N>(e:GBase, str:string, file?:string, pos?:number):MatchResult<T> {
    let context = new ReaderContext(new Reader(str, file, pos));
    return new MatchResult(<T>e.match(context), context);
}
export function match<T extends N>(e:Class<T>, str:string, file?:string, pos?:number):MatchResult<T> {
    return match2<T>(<GBase>(<any>e).matcher, str, file, pos);
}
