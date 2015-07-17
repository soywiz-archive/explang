///<reference path="mocha.d.ts" />

import _grammar = require('../grammar');
import lang_grammar = require('../lang_grammar');
import lang_services = require('../lang_services');
import gen_js = require('../gen_js');
import ir = require('../ir_ast');
import compiler = require('../compiler');
import assert = require("assert"); // node.js core module

var grammar = new _grammar.Grammar();

function testProgramJs(src:string, expectedJs:string) {
	var grammarResult = grammar.match(src, lang_grammar._stms);
	if (!grammarResult.matched) {
		throw new Error(`Not matched ${grammarResult}`);
	}
	if (grammarResult.endOfFile) {
		throw new Error(`End of file ${grammarResult}`);
	}
	var compilerResult = compiler.compile(grammarResult.node);
	if (compilerResult.errors.length > 0) {
		throw new Error(`Program had errors [${compilerResult.errors.join(',')}]`);
	}
	assert.equal(
		expectedJs,
		gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim()
	);
}

function testProgramEvalJs(src:string, expectedResult:any) {
	var grammarResult = grammar.match(src, lang_grammar._stms);
	if (!grammarResult.matched) {
		throw new Error(`Not matched ${grammarResult}`);
	}
	if (grammarResult.endOfFile) {
		throw new Error(`End of file ${grammarResult}`);
	}
	var compilerResult = compiler.compile(grammarResult.node);
	if (compilerResult.errors.length > 0) {
		throw new Error(`Program had errors [${compilerResult.errors.join(',')}]`);
	}
	
	assert.equal(
		expectedResult,
		eval('(function() { ' + gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim() + ' return Main.main(); })()')
	);
}

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
		var mod = new ir.IrModule();
		var b = new ir.NodeBuilder();
		var TestClass = mod.createClass('Test');
		var demoMethod = TestClass.createMethod('demo', false, b.ret(b.int(10)));
		assert.equal(
			"var Test = (function () { function Test() { } Test.prototype.demo = function() { return 10; }; return Test; })();",
			gen_js.generate(mod).replace(/\s+/mgi, ' ').trim()
		);
	});

	it('compile', () => {
		testProgramJs(
			'class Test123 { }',
			"var Test123 = (function () { function Test123 () { } return Test123 ; })();"
		);
	});
	
	it('compile2', () => {
		testProgramJs(
			'return;',
			"var Main = (function () { function Main() { } Main.main = function() { return ; }; return Main; })();"
		);
	});

	it('run1', () => {
		testProgramEvalJs('return 10;', 10);
	});
});
