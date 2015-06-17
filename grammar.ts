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
        if (this.str.substr(this.pos, lit.length) != lit) return null;
        return this.readRange(lit.length);
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

/*
export class NodeInfo {
    public tokens:TRange[];
    public range:TRange;
    
    public constructor(tokens:TRange[]) {
        this.tokens = tokens;
        this.range = TRange.combineList(tokens);
    }

    addInfo(info: NodeInfo) {
        this.addTokens(info.tokens);
    }
    
    addTokens(add:TRange[]) {
        this.tokens = this.tokens.concat(add);
        this.range = TRange.combineList(this.tokens);
    }
    
    get text() {
        if (this.range == null) return '';
        return this.range.text;
    }
}
*/

export class Language {
    public constructor(public name:string) {
    }
}

export class PsiFile {
    constructor(public reader:Reader) {
        
    }    
}

export class PsiElement {
    public language:Language;
    public parent:PsiElement;

    constructor(public file:PsiFile, public range:TRange, public children:PsiElement[] = []) {
        for (let child of children) {
            child.parent = this;
        }
    }
    
    static create<T extends PsiElement>(clazz:Class<T>, file:PsiFile, range:TRange, children:PsiElement[] = []):T {
        return new clazz(file, range, children);
    }

    get type() {
        return '' + (<any>this.constructor).name;
    }
    
    get text() { return this.range.text; }
    
    getChildsOfType<T>(clazz:Class<T>):T[] {
        return <T[]><any[]>this.children.filter(c => c instanceof clazz);
    }
    
    get first() { return this.children.length ? this.children[0] : null; }
    get last() { return this.children.length ? this.children[this.children.length - 1] : null; }
 
   as<T extends PsiElement>(clazz:Class<T>) {
        return <T>this;
    }
}

export class ListGrammarNode<T extends PsiElement> extends PsiElement {
    public elements:T[];
    public separators:PsiElement[];
}

export class SequenceGrammarNode extends PsiElement {
}

export class UnmatchGrammarNode extends PsiElement {
}

export class GrammarResult {
    public name:string = null;
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

export class GBase {
    /*
    constructor(build: () => string) {
    }
    */
    
	match(readerContext:ReaderContext):GrammarResult {
        throw "Must override match";
    }
}

export class GSure extends GBase {
	match(context:ReaderContext):GrammarResult {
        context.skip();
        return GrammarResult.matched('sure', context.createEmptyPsi(UnmatchGrammarNode));
    }
}

export class GLiteral extends GBase {
	public constructor(public value:string, public clazz:Class<PsiElement> = UnmatchGrammarNode) {
		super();
	}

	match(context:ReaderContext):GrammarResult {
        context.skip();
        var result = context.reader.matchLitRange(this.value);
        var clazz = this.clazz;
        var reason = `literal("${this.value}")`;
        return (result == null)
            ? GrammarResult.unmatched(reason)
            : GrammarResult.matched(reason, context.createEmptyPsi(clazz, result))
        ; 
    }
}

export class GRegExp extends GBase {
	public constructor(public value:RegExp, public clazz:Class<PsiElement> = UnmatchGrammarNode) {
		super();
	}

	match(context:ReaderContext):GrammarResult {
        context.skip();
        var result = context.reader.matchERegRange(this.value);
        var clazz = this.clazz;
        var reason = `regexp(${this.value})`;
        return (result == null)
            ? GrammarResult.unmatched(reason)
            : GrammarResult.matched(reason, context.createEmptyPsi(clazz, result))
        ; 
    }
}

export class GAny extends GBase {
	public constructor(public items:GBase[]) {
		super();
	}
    
   	match(readerContext:ReaderContext):GrammarResult {
        var reader = readerContext.reader;
        readerContext.skip();
        var start = readerContext.reader.pos;
        for (var i of this.items) {
            var result = i.match(readerContext);
            if (result.matched) {
                return result;
            }
            reader.pos = start;
        }
        return GrammarResult.unmatched('any');
    }
}

export class GOptional extends GBase {
	public constructor(public value:GBase) {
		super();
	}
    
   	match(context:ReaderContext):GrammarResult {
        var reader = context.reader;
        context.skip();
        var start = context.reader.pos;
        var v = this.value.match(context);
        if (v.matched) return v;
        reader.pos = start;
        return GrammarResult.matched('opt', context.createEmptyPsi(PsiElement));
    }
}

export class GCapture extends GBase {
	public constructor(public value:GBase, public name:string) {
		super();
	}
    
   	match(readerContext:ReaderContext):GrammarResult {
        var result = this.value.match(readerContext);
        result.name = this.name;
        return result;
    }
}

export class GRef extends GBase {
    value:GBase;
    
	public constructor() {
		super();
	}
    
    set(value:GBase) {
        this.value = value;
        return this;
    }
    
   	match(readerContext:ReaderContext):GrammarResult {
        return this.value.match(readerContext);
    } 
}

export class GSkipper extends GBase {
	public constructor(public value:GBase, public skipper: Skipper) {
		super();
	}
    
   	match(readerContext:ReaderContext):GrammarResult {
        readerContext.pushSkipper(this.skipper);
        try {
            var result = this.value.match(readerContext);
            return result;
        } finally {
            readerContext.popSkipper();
        }
    }
}

export class GSequence extends GBase {
	public constructor(public items:GBase[], public clazz?:Class<PsiElement>) {
		super();
	}
    
    match(context:ReaderContext):GrammarResult {
        context.skip();
        var startPos = context.reader.pos;
        var nodes:PsiElement[] = [];
        var results:GrammarResult[] = [];
        var sure = false;
        for (var i of this.items) {
            if (i instanceof GSure) {
                sure = true;
                continue;
            }
            var r = i.match(context);
            if (!r.matched) {
                context.reader.pos = startPos;
                return GrammarResult.unmatched('seq');
            }
            nodes.push(r.node);
            results.push(r);
        }
        var clazz = this.clazz;
        if (clazz == null) clazz = SequenceGrammarNode;
        var element = context.createPsi(clazz, nodes);
        for (let r of results) {
            if (r.name != null) {
                (<any>element)[r.name] = r.node;
            }
        }
        return GrammarResult.matched('seq', element);
    }
}

export class GList extends GBase {
	public constructor(public element:GBase, public separator:GBase, public min:number, public clazz?:Class<ListGrammarNode<PsiElement>>) {
		super();
	}
    
    match(context:ReaderContext):GrammarResult {
        context.skip();
        var r2 = GrammarResult.matched('list:0', context.createEmptyPsi(PsiElement));
        var all:PsiElement[] = [];
        var elements:PsiElement[] = [];
        var separators:PsiElement[] = [];
        var count = 0;
        while (!context.reader.eof) {
            var r = this.element.match(context);
            if (!r.matched && r2.matched && this.separator != null) return GrammarResult.unmatched('list:1');
            if (!r.matched) {
                break;
            }
            count++;
            all.push(r.node);

            elements.push(r.node);
            if (this.separator != null) {
                r2 = this.separator.match(context);
                if (r2.node) {
                    all.push(r2.node);
                    separators.push(r2.node);
                }
            }
        }
        if (count < this.min) return GrammarResult.unmatched('list:2');
        var clazz = this.clazz;
        if (clazz == null) clazz = ListGrammarNode;
        var i2:ListGrammarNode<PsiElement> = <ListGrammarNode<PsiElement>>context.createPsi(clazz, all);
        i2.separators = separators;
        i2.elements = elements;
        return GrammarResult.matched('list:3', i2);
    }
}

export class Grammar {
	match(str:string, root:GBase):GrammarResult {
        return root.match(new ReaderContext(new Reader(str)));
    }
}

type anytok = string | RegExp | GBase;

export function tok(v: anytok, clazz?:Class<PsiElement>) {
    if (v == null) return null;
    if (v instanceof GBase) {
        return v;
    } else if (v instanceof RegExp) { 
        return new GRegExp(v, clazz);
    } else {
        return new GLiteral(<string>v, clazz);
    }
}
export function _tok(v: anytok) { return tok(v); }

export function seq(list:anytok[], clazz?:Class<PsiElement>) { return new GSequence(list.map(_tok), clazz); }
export function _any(list:anytok[]) { return new GAny(list.map(_tok)); }
export function opt(v:anytok) { return new GOptional(tok(v)); }
export function sure() { return new GSure(); }
export function capture(v: GBase, name:string) { return new GCapture(v, name); }
export function ref() { return new GRef(); }
export function list(element:anytok, separator?:anytok, min:number = 1, clazz?:Class<ListGrammarNode<PsiElement>>) {
    return new GList(tok(element), tok(separator), min, clazz);
}

interface Class<T> { new(...args:any[]):T; }

//console.log(_if.match(new ReaderContext(new Reader('if ((1)) 1; else 1;'))));
//console.log(_stms.match(new ReaderContext(new Reader('var a; var b; function test() {}'))));
//console.log(_stms.match(new ReaderContext(new Reader('var a:int = 1, b = 3;'))));
//console.log(_stms.match(new ReaderContext(new Reader('class Test { lazy var a = 10; }'))));
//console.log(_stms.match(new ReaderContext(new Reader('var a = ((c, d) => 10);'))));
//console.log(_lit.match(new ReaderContext(new Reader('777.3'))));

export function test() {
    
}