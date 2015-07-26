/// <reference path="./defs.d.ts" />

import _grammar = require('./grammar');

export import TRange = _grammar.TRange;
export import PsiElement = _grammar.PsiElement;
export import PsiNode = _grammar.PsiNode;
export import ListGrammarNode = _grammar.ListGrammarNode;
export import UnmatchGrammarNode = _grammar.UnmatchGrammarNode;
export import SequenceGrammarNode = _grammar.SequenceGrammarNode;

/*
class Expr extends PsiElement {
}

class Stm extends PsiElement {
}
*/

export class VarDecl extends PsiElement {
    public name:Id;
    public init:PsiElement;
    //public vars:Var;
    
    public get initExpr():PsiElement {
        return this.init.children[1];
    }
}

export class FunctionExpBody extends PsiElement {
    expr:PsiElement;
}

export class FunctionStmBody extends PsiElement {
    stm:PsiElement;
}

export class Function extends PsiElement {
    id_wg:PsiElement;
    args:PsiElement;
    typetag:PsiElement = null;
    body:PsiElement;
    get fargs():Argument[] {
        return this.args.getChildrenOfType(Argument);
    }
}

export class Argument extends PsiElement {
    name:PsiElement;
    typetag:PsiElement;
    init:PsiElement;
}

export class VarDecls extends PsiElement {
    public get vars():VarDecl[] {
        return this.children[2].getChildrenOfType(VarDecl);
    }
}

export class BinaryOp extends PsiElement {
}

export class ExpressionStm extends ListGrammarNode<PsiElement> {
    get expression():PsiElement {
        return this.children[0].as(PsiElement);
    }
}

export class Stms extends ListGrammarNode<PsiElement> {
    get stms():PsiElement[] {
        return this.elements;
    }
}

export class StmsGroup extends ListGrammarNode<PsiElement> {
    _stms:Stms;
    get stms():PsiElement[] {
        return this._stms.elements;
    }
}

export class BinaryOpList extends ListGrammarNode<PsiElement> {
    public get expressions() {
        return this.children.filter(c => !(c instanceof UnmatchGrammarNode));
    }
    public get operatorsRaw() {
        return this.separators;
    }
}

export class AccessField extends ListGrammarNode<PsiElement> {
    id:PsiElement;
}
export class AccessFieldOpt extends ListGrammarNode<PsiElement> { }
export class AccessArray extends ListGrammarNode<PsiElement> {
    expr: PsiElement;
}
export class AccessCall extends ListGrammarNode<PsiElement> {
    public get args() {
        return this.children[1].children;
    }
}

export class CallOrArrayAccess extends ListGrammarNode<PsiElement> {
    get left() {
        return this.children[0];
    }

    get parts():PsiElement[] {
        return this.children[1].children;
    }
}

export class TypeTag extends PsiElement {
    
}

export class If extends PsiElement {
    public expr:PsiElement;
    public codeTrue:PsiElement;
    public codeFalse:PsiElement;
}

export class IdWithGenerics extends PsiElement {
    public id:Id;
    public generics:PsiElement;
}

export class Class extends PsiElement {
    public idwg:IdWithGenerics;
    public body:PsiElement;
}

export class Interface extends PsiElement {
    public idwg:IdWithGenerics;
}

export class Extension extends PsiElement {
}

export class Struct extends PsiElement {
}

export class Enum extends PsiElement {
}

export class While extends PsiElement {
    public expr:PsiElement;
    public code:PsiElement;
}

export class Continue extends PsiElement { }
export class Break extends PsiElement { }
export class Fallthrough extends PsiElement { }

export class For extends PsiElement {
    public id:PsiElement;
    public expr:PsiElement;
    public stm:PsiElement;
}

export class Return extends PsiElement {
    public expr:PsiElement;
}

export class Do extends PsiElement {
    public code:PsiElement
    public expr:PsiElement;
}

export class Id extends PsiElement {
}

export class Int extends PsiElement {
    value = 0;
    protected init() {
        this.value = parseInt(this.text);
    }
}
export class Bool extends PsiElement {
    value = false;
    protected init() {
        this.value = (this.text == 'true');
    }
}
export class Float extends PsiElement {
    value = 0;
    protected init() {
        this.value = parseFloat(this.text);
    }  
}
