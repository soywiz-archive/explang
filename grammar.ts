export class TRange {
    public constructor(public min:number, public max:number, public reader:Reader) { }
    static combine(a:TRange, b:TRange):TRange {
        return new TRange(Math.min(a.min, b.min), Math.max(a.max, b.max), a.reader);
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
    public constructor(public reader:Reader) {
        this.pushSkipper(context => {
            context.reader.matchEReg(/^\s+/);
        });
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

export class GrammarNode {
    type = 'GrammarNode';
    constructor(public tokens:TRange[]) {
    }
    get text() {
        if (this.tokens.length == 0) return '';
        var min = this.tokens[0].min;
        var max = this.tokens[this.tokens.length - 1].max;
        return this.tokens[0].reader.slice(min, max);
    }
    as<T extends GrammarNode>(clazz:Class<T>) {
        return <T>this;
    }
}

export class ListGrammarNode extends GrammarNode {
    type = 'ListGrammarNode';
    public constructor(tokens:TRange[], public values:GrammarNode[], public separators:GrammarNode[]) {
        super(tokens);
    }
}

export class SequenceGrammarNode extends GrammarNode {
    type = 'SequenceGrammarNode';
    public constructor(tokens:TRange[], public items:GrammarNode[]) {
        super(tokens);
    }
}

export class UnmatchGrammarNode extends GrammarNode {
    type = 'UnmatchGrammarNode';
    constructor(public tokens:TRange[]) {
        super(tokens);
    }
}

export class GrammarResult {
    public constructor(public matched:Boolean, public node:GrammarNode) {
    }
    get text() {
        return this.node.text;
    }
    toString() {
        return this.node.text;
    }
    static matched(node:GrammarNode) {
        return new GrammarResult(true, node);
    }
    static unmatched() {
        return new GrammarResult(false, null);
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
	match(readerContext:ReaderContext):GrammarResult {
        readerContext.skip();
        return GrammarResult.matched(new UnmatchGrammarNode([]));
    }
}

export class GLiteral extends GBase {
	public constructor(public value:string, public clazz:Class<GrammarNode> = UnmatchGrammarNode) {
		super();
	}

	match(readerContext:ReaderContext):GrammarResult {
        readerContext.skip();
        var result = readerContext.reader.matchLitRange(this.value);
        var clazz = this.clazz;
        return (result == null) ? GrammarResult.unmatched() : GrammarResult.matched(new clazz([result])); 
    }
}

export class GRegExp extends GBase {
	public constructor(public value:RegExp, public clazz:Class<GrammarNode> = UnmatchGrammarNode) {
		super();
	}

	match(readerContext:ReaderContext):GrammarResult {
        readerContext.skip();
        var result = readerContext.reader.matchERegRange(this.value);
        var clazz = this.clazz;
        return (result == null) ? GrammarResult.unmatched() : GrammarResult.matched(new clazz([result])); 
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
        return GrammarResult.unmatched();
    }
}

export class GOptional extends GBase {
	public constructor(public value:GBase) {
		super();
	}
    
   	match(readerContext:ReaderContext):GrammarResult {
        var reader = readerContext.reader;
        readerContext.skip();
        var start = readerContext.reader.pos;
        var v = this.value.match(readerContext);
        if (v.matched) return v;
        reader.pos = start;
        return GrammarResult.matched(new GrammarNode([]));
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
	public constructor(public items:GBase[], public clazz?:Class<GrammarNode>) {
		super();
	}
    
    match(readerContext:ReaderContext):GrammarResult {
        readerContext.skip();
        var startPos = readerContext.reader.pos;
        var tokens:TRange[] = [];
        var nodes:GrammarNode[] = [];
        var sure = false;
        for (var i of this.items) {
            if (i instanceof GSure) {
                sure = true;
                continue;
            }
            var r = i.match(readerContext);
            //console.log(i.constructor, i, r);
            if (!r.matched) {
                readerContext.reader.pos = startPos;
                return r;
            }
            tokens = tokens.concat(r.node.tokens);
            if (r.node && !(r.node instanceof UnmatchGrammarNode)) nodes.push(r.node);
        }
        var clazz = this.clazz;
        if (clazz == null) clazz = SequenceGrammarNode;
        return GrammarResult.matched(new clazz(tokens, nodes));
    }
}

export class GList extends GBase {
	public constructor(public element:GBase, public separator:GBase, public min:number, public clazz?:Class<ListGrammarNode>) {
		super();
	}
    
    match(readerContext:ReaderContext):GrammarResult {
        readerContext.skip();
        var r2 = GrammarResult.matched(new GrammarNode([]));
        var tokens:TRange[] = [];
        var elements:GrammarNode[] = [];
        var separators:GrammarNode[] = [];
        var count = 0;
        while (!readerContext.reader.eof) {
            var r = this.element.match(readerContext);
            if (!r.matched && r2.matched && this.separator != null) return GrammarResult.unmatched();
            if (!r.matched) {
                break;
            }
            count++;
            tokens = tokens.concat(r.node.tokens);
            elements.push(r.node);
            if (this.separator != null) {
                r2 = this.separator.match(readerContext);
                if (r2.node) {
                    tokens = tokens.concat(r2.node.tokens);
                    separators.push(r2.node);
                }
            }
        }
        if (count < this.min) return GrammarResult.unmatched();
        var clazz = this.clazz;
        if (clazz == null) clazz = ListGrammarNode;
        return GrammarResult.matched(new clazz(tokens, elements, separators));
    }
}

export class Grammar {
	match(str:string, root:GBase):GrammarResult {
        return root.match(new ReaderContext(new Reader(str)));
    }
}

type anytok = string | RegExp | GBase;

export function tok(v: anytok, clazz?:Class<GrammarNode>) {
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

export function seq(list:anytok[], clazz?:Class<GrammarNode>) { return new GSequence(list.map(_tok), clazz); }
export function _any(list:anytok[]) { return new GAny(list.map(_tok)); }
export function opt(v:anytok) { return new GOptional(tok(v)); }
export function sure() { return new GSure(); }
export function ref() { return new GRef(); }
export function list(element:anytok, separator?:anytok, min:number = 1, clazz?:Class<ListGrammarNode>) {
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