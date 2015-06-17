import {
	TRange,
	ListGrammarNode,
	Grammar,
	ref, list, tok, _any, seq, sure, capture, opt,
} from './grammar';

import ast = require('./lang_ast');

export var _expr = ref();
var _expr1 = ref();
var _expr2 = ref();
var _stm = ref();
var _typedecl = ref();

export var _stms = list(_stm, null, 0); 

var _float = tok(/^(\d+\.\d+|\d*\.\d+|\d+\.[^\.])/, ast.Float);
var _int = tok(/^\d[\d_]*/, ast.Int);
var _bool = _any([tok('true', ast.Bool), tok('false', ast.Bool)]);
var _id = tok(/^[a-z]\w*/i, ast.Int);
var _id_wg = seq([_id, opt(seq(['<', list(_id, ','), '>']))]);
var _lit = _any([_bool, _float, _int]);
var _unop = _any([
    '++', '--',
    '+', '-', '!', '~'
   ]);
var _binop = _any([
    '<=>', '===', '!==', '...', 
    '&&', '||', '==', '!=', '..', '<=', '>=', 'is', 'as',
    '+', '-', '/', '*', '%', '&', '|', '^', '<', '>',
 ]);

var _access1 = seq(['.', sure(), _id]);
var _access2 = seq(['?.', sure(), _id]);
var _access3 = seq(['[', sure(), _expr, ']']);
var _access4 = seq(['(', sure(), list(_expr, ','), ')']);
var _access = _any([_access1, _access2, _access3, _access4, '++', '--']);

_expr1.set(_any([
    _lit,
    seq([_unop, _expr1]),
    seq(['(', _expr, ')']),
    seq(['[', list(_expr, ',', 0), ']']), // array literal
])); 

_expr2.set(_any([
    seq([_expr1, list(_access, null, 0)]),
]));

var _func_arg = seq([_id, opt(seq([':', _typedecl])), opt(seq(['=', _expr]))]);
var _func_args = list(_func_arg, ',');

_expr.set(_any([
    seq(['(', _func_args, ')', '=>', sure(), _expr]),
    seq([_id, '=>', sure(), _expr]),
    seq(['await', sure(), _expr]),
    seq(['yield', sure(), _expr]),
    list(_expr2, _binop, 1, <any>ast.BinaryOpList)
]));

_typedecl.set(_any([
    _id
]));

var _sc_typedecl = seq([':', _typedecl]);

var _staticif = seq(['static', 'if', sure(), '(', _expr, ')', _stm, opt(seq(['else', _stm]))], ast.If);
export var _if = seq([
    'if', sure(), '(', capture(_expr, 'expr'), ')', capture(_stm, 'codeTrue'), opt(seq(['else', capture(_stm, 'codeFalse')]))],
    ast.If
);
var _for = seq(['for', sure(), '(', _id, 'in', _expr, ')', _stm]);
var _while = seq(['while', sure(), '(', capture(_expr, 'expr'), ')', capture(_stm, 'code')], ast.While);
var _do = seq(['do', sure(), capture(_stm, 'code'), 'while', '(' , capture(_expr, 'expr'), ')', ';'], ast.Do);
var _return = seq(['return', sure(), capture(opt(_expr), 'expr'), ';'], ast.Return);
var _continue = seq(['continue', ';']);
var _break = seq(['break', ';']);
var _fallthrough = seq(['fallthrough', ';']);
var _class = seq(['class', sure(), _id_wg, '{', _stms, '}']);
var _extension = seq(['extension', sure(), _id_wg, '{', _stms, '}']);
var _struct = seq(['struct', sure(), _id, '{', '}']);
var _enum = seq(['enum', sure(), _id, '{', '}']);
var _vardecl = seq([_id, opt(_sc_typedecl), opt(seq([_any(['=>', '=']), _expr]))]);
var _vars = seq([opt('lazy'), 'var', sure(), list(_vardecl, ',', 1), ';'], ast.VarDecl);
var _function = seq(
    ['function', sure(), _id_wg, '(', _func_args, ')', _any([
        seq(['=>', _expr, ';']),
        seq([opt(_sc_typedecl), _stm]),
    ])
]);
//var _var = seq([opt('lazy'), 'var', sure(), _id, ';']);
_stm.set(_any([
    ';',
    seq(['{', _stms, '}']),
    _staticif,
    _if,
    _for,
    _while,
    _return,
    _class,
    _extension,
    _enum,
    _vars,
    _function,
    _continue,
    _break,
    _fallthrough,
    seq([_expr, ';']),
]));
