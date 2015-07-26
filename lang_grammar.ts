/// <reference path="./defs.d.ts" />

import {
	TRange,
	ListGrammarNode,
	Grammar,
	ref, list, tok, _any, sq, sq2, seq, sure, capture, opt,
} from './grammar';

import ast = require('./lang_ast');

export var _expr = ref();
var _expr1 = ref();
var _expr2 = ref();
var _stm = ref();
var _typedecl = ref();

export var _stms = list(_stm, null, 0, ast.Stms); 

var _float = tok(/^(\d+\.\d+|\d*\.\d+|\d+\.[^\.])/, ast.Float);
var _int = tok(/^\d[\d_]*/, ast.Int);
var _bool = _any(tok('true', ast.Bool), tok('false', ast.Bool));
var _id = tok(/^[a-z]\w*/i, ast.Id);
var _id_wg = seq([capture('id', _id), opt(seq(['<', capture('generics', list(_id, ',')), '>']))], ast.IdWithGenerics);
var _lit = _any(_bool, _float, _int, _id);
var _unop = _any(
    '++', '--',
    '+', '-', '!', '~'
);
var _binop = _any(
    '<=>', '===', '!==', '...', 
    '&&', '||', '==', '!=', '..', '<=', '>=', '**', 'is', 'as',
    "+=","-=","*=","/=","%=","<<=",">>=",">>>=","|=","&=","^=",
    "=", '+', '-', '/', '*', '%', '&', '|', '^', '<', '>'
);

var _access1 = seq(['.', sure(), capture('id', _id)], ast.AccessField);
var _access2 = seq(['?.', sure(), _id], ast.AccessFieldOpt);
var _access3 = seq(['[', sure(), capture('expr', _expr), ']'], ast.AccessArray);
var _access4 = seq(['(', sure(), list(_expr, ','), ')'], ast.AccessCall);
var _access = _any(_access1, _access2, _access3, _access4, '++', '--');

_expr1.set(_any(
    _lit,
    seq([_unop, _expr1]),
    seq(['(', _expr, ')']),
    seq(['[', list(_expr, ',', 0), ']']) // array literal
)); 

_expr2.set(_any(
    seq([_expr1, list(_access, null, 0)], ast.CallOrArrayAccess) // callOrArrayAccess
));

var _func_arg = seq([capture('name', _id), capture('typetag', opt(seq([':', _typedecl]))), capture('init', opt(seq(['=', _expr])))], ast.Argument);
var _func_args = list(_func_arg, ',', 0);

_expr.set(_any(
    seq(['(', _func_args, ')', '=>', sure(), _expr]),
    seq([_id, '=>', sure(), _expr]),
    seq(['await', sure(), _expr]),
    seq(['yield', sure(), _expr]),
    list(_expr2, _binop, 1, <any>ast.BinaryOpList)
));

_typedecl.set(_any(
    _id
));

var _sc_typetag = seq([':', _typedecl], ast.TypeTag);

var _staticif = seq(['static', 'if', sure(), '(', _expr, ')', _stm, opt(seq(['else', _stm]))], ast.If);
export var _if = seq([
    'if', sure(), '(', capture('expr', _expr), ')', capture('codeTrue', _stm), opt(seq(['else', capture('codeFalse', _stm)]))],
    ast.If
);

/*
var _classdecl = _any(
    sq(_id, _sc_typetag, ';')
);
*/

//var _classparam = sq2(ast.PsiElement, capture('id', _id), capture('typetag', _sc_typetag));
//var _classparams = sq2(ast.PsiElement, '(', list(), ')');

var _for = seq(['for', sure(), '(', capture('id', _id), 'in', capture('expr', _expr), ')', capture('stm', _stm)], ast.For);
var _while = seq(['while', sure(), '(', capture('expr', _expr), ')', capture('code', _stm)], ast.While);
var _do = seq(['do', sure(), capture('code', _stm), 'while', '(' , capture('expr', _expr), ')', ';'], ast.Do);
var _return = seq(['return', sure(), capture('expr', opt(_expr)), ';'], ast.Return);
var _continue = seq(['continue', ';'], ast.Continue);
var _break = seq(['break', ';'], ast.Break);
var _fallthrough = seq(['fallthrough', ';'], ast.Fallthrough);
var _class = seq(['class', sure(), capture('idwg', _id_wg), capture('body', _stm)], ast.Class);
var _interface = seq(['interface', sure(), capture('idwg', _id_wg), capture('body', _stm)], ast.Interface);
var _extension = seq(['extension', sure(), _id_wg, capture('body', _stm)], ast.Extension);
var _struct = seq(['struct', sure(), capture('id', _id), '(', ')', capture('body', _stm)], ast.Struct);
var _enum = seq(['enum', sure(), _id, '{', '}'], ast.Enum);
var _vardecl = seq([capture('name', _id), opt(_sc_typetag), capture('init', opt(seq([_any('=>', '='), capture('init', _expr)])))], ast.VarDecl);
var _vars = seq([opt('lazy'), 'var', sure(), capture('vars', list(_vardecl, ',', 1)), ';'], ast.VarDecls);
var _function = seq([
    'function', sure(), capture('id_wg', _id_wg), '(', capture('args', _func_args), ')', capture('typetag', opt(_sc_typetag)), capture('body', _any(
        seq(['=>', sure(), capture('expr', _expr), ';'], ast.FunctionExpBody),
        seq([capture('stm', _stm)], ast.FunctionStmBody)
    ))
], ast.Function);
//var _var = seq([opt('lazy'), 'var', sure(), _id, ';']);
_stm.set(_any(
    ';',
    seq(['{', capture('_stms', _stms), '}'], ast.StmsGroup),
    _staticif,
    _if,
    _for,
    _while,
    _return,
    _class,
    _interface,
    _extension,
    _enum,
    _vars,
    _function,
    _continue,
    _break,
    _fallthrough,
    seq([_expr, ';'], ast.ExpressionStm)
));
