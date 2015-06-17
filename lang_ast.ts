import _grammar = require('./grammar');

export import TRange = _grammar.TRange;
export import PsiElement = _grammar.PsiElement;
export import ListGrammarNode = _grammar.ListGrammarNode;
export import UnmatchGrammarNode = _grammar.UnmatchGrammarNode;
export import SequenceGrammarNode = _grammar.SequenceGrammarNode;

export class Expr extends PsiElement {
}

export class Stm extends PsiElement {
}

export class VarDecl extends PsiElement {
}

export class BinaryOp extends PsiElement {
}

export class BinaryOpList extends Expr {
    /*
    public get operatorsRaw() {
        return this.operators.map(o => o.info.tokens[0].text);
    }
    */
}

export class If extends Stm {
    public expr:Expr;
    public codeTrue:Stm;
    public codeFalse:Stm;

}
export class While extends Stm {
    public expr:Expr;
    public code:Stm;
}

export class Return extends Stm {
    public expr:Expr;
}

export class Do extends Stm {
    public code:Stm;
    public expr:Expr;
}

export class Int extends Expr {
    value = 0;
    protected init() {
        this.value = parseInt(this.text);
    }
}
export class Bool extends Expr {
    value = false;
    protected init() {
        this.value = (this.text == 'true');
    }
}
export class Float extends Expr {
    value = 0;
    protected init() {
        this.value = parseFloat(this.text);
    }  
}
