import _grammar = require('./grammar');
import lang_grammar = require('./lang_grammar');

var grammar = new _grammar.Grammar();

console.log(grammar.match('true;', lang_grammar._stms).text);
