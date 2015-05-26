///<reference path="mocha.d.ts" />

import _grammar = require('../grammar');
import lang_grammar = require('../lang_grammar');
import assert = require("assert"); // node.js core module

var grammar = new _grammar.Grammar();

describe('test', () => {
	it('simple match', () => {
		assert.equal('true;', grammar.match('true;', lang_grammar._stms).text);
		assert.equal('if (1) ;', grammar.match('if (1) ;', lang_grammar._stms).text);
		assert.equal('while (true) { }', grammar.match('while (true) { }', lang_grammar._stms).text);
		assert.equal('var a = 1;', grammar.match('var a = 1;', lang_grammar._stms).text);
		assert.equal('var a => 1;', grammar.match('var a => 1;', lang_grammar._stms).text);
		assert.equal('if (true) 1; else 2;', grammar.match('if (true) 1; else 2;', lang_grammar._stms).text);
		assert.equal('var a = 3; var b = 4;', grammar.match('var a = 3; var b = 4;', lang_grammar._stms).text);
	});
});
