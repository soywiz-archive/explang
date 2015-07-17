///<reference path="mocha.d.ts" />

import _grammar = require('../grammar');
import lang_grammar = require('../lang_grammar');
import lang_services = require('../lang_services');
import gen_js = require('../gen_js');
import ir = require('../ir_ast');
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
		
		//var node = grammar.match('if (1 + 1) { }', lang_grammar._stms).node;
		var node = grammar.match('var a = 100; return a + 2;', lang_grammar._stms).node;
		lang_services.Services.pass1(node);
	});
	
	it('js gen', () => {
		var gen = new gen_js.Generator();
		var mod = new ir.IrModule();
		var b = new ir.NodeBuilder();
		var TestClass = mod.createClass('Test');
		var demoMethod = TestClass.createMethod('demo', b.ret(b.imm(10)));
		gen.generateModule(mod);
		assert.equal(
			"var Test = (function () { function Test() { } Test.prototype.demo = function() { return 10; }; return Test; })();",
			gen.toString().replace(/\s+/mgi, ' ').trim()
		);
	});
});
