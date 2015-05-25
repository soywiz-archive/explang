import _grammar = require('./grammar');

export import NodeInfo = _grammar.NodeInfo;
export import TRange = _grammar.TRange;
export import GrammarNode = _grammar.GrammarNode;
export import ListGrammarNode = _grammar.ListGrammarNode;
export import UnmatchGrammarNode = _grammar.UnmatchGrammarNode;
export import SequenceGrammarNode = _grammar.SequenceGrammarNode;

export class BinaryOp extends GrammarNode {
    type = 'BinaryOp';
    
    public constructor(info:NodeInfo, public left:GrammarNode, public op:string, public right:GrammarNode) {
        super(info);
    }
}

export class BinaryOpList extends ListGrammarNode {
    type = 'BinaryOpList';
    public constructor(info:NodeInfo, public values:GrammarNode[], public operators:GrammarNode[]) {
        super(info, values, operators);
    }
    public get operatorsRaw() {
        return this.operators.map(o => o.info.tokens[0].text);
    }
}

export class IfNode extends GrammarNode {
    type = 'IfNode';
    public expr:GrammarNode;
    public codeTrue:GrammarNode;
    public codeFalse:GrammarNode;
    
    public constructor(info:NodeInfo, nodes:GrammarNode[]) {
        super(info);
        this.expr = nodes[0];
        this.codeTrue = nodes[1];
        this.codeFalse = nodes[2];
    }
}
export class WhileNode extends GrammarNode {
    type = 'WhileNode';
    public expr:GrammarNode;
    public code:GrammarNode;
    
    public constructor(info:NodeInfo, nodes:GrammarNode[]) {
        super(info);
        this.expr = nodes[0];
        this.code = nodes[1];
    }
}
export class IntNode extends GrammarNode {
    type = 'IntNode';
    value = 0;
    public constructor(info:NodeInfo) {
        super(info);
        //console.log(info.tokens);
        //console.log(info.range);
        this.value = parseInt(info.tokens[0].text);
    }  
}
export class BoolNode extends GrammarNode {
    type = 'BoolNode';
    value = false;
    public constructor(info:NodeInfo) {
        super(info);
        this.value = (info.tokens[0].text == 'true');
    }  
}
export class FloatNode extends GrammarNode {
    type = 'FloatNode';
    value = 0;
    public constructor(info:NodeInfo) {
        super(info);
        this.value = parseFloat(info.tokens[0].text);
    }  
}
