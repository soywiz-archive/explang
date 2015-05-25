///<reference path="mocha.d.ts" />

import _grammar = require('../grammar');
import lang_grammar = require('../lang_grammar');
import assert = require("assert"); // node.js core module

var grammar = new _grammar.Grammar();

describe('test', () => {
	it('test', () => {
		assert.equal('true;', grammar.match('true;', lang_grammar._stms).text);
		assert.equal('----', grammar.match('function a() => 10;', lang_grammar._stms).text);
		//assert.equal('---', grammar.match('if (1) ;', lang_grammar._stms).text);
	});
});
