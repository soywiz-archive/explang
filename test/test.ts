///<reference path="mocha.d.ts" />
///<reference path="../defs.d.ts" />

import _grammar = require('../grammar');
import lang_grammar = require('../lang_grammar');
import gen_js = require('../gen_js');
import gen_jvm = require('../gen_jvm');
import ir = require('../ir_ast');
import compiler = require('../compiler');
import assert = require("assert"); // node.js core module
import vfs = require('../vfs');

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
	let grammarResult = grammar.match(src, lang_grammar._stms);
	if (!grammarResult.matched) {
		throw new Error(`Not matched ${grammarResult}`);
	}
	if (grammarResult.endOfFile) {
		throw new Error(`End of file ${grammarResult}`);
	}
	let compilerResult = compiler.compile(grammarResult.node);
	if (compilerResult.errors.length > 0) {
		throw new Error(`Program had errors [${compilerResult.errors.join(',')}]`);
	}
	
	let result:any = undefined
	let code = '(function() { ' + gen_js.generateRuntime() + gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim() + ' return Main.main(); })()';
	try {
		result = eval(code);
	} catch (e) {
		console.log(code);
		console.error(e);
	}
	
	assert.equal(
		expectedResult,
		result
	);
}

vfs.cwd().access('Example.class').write(gen_jvm.generateExample());

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
		//var node = grammar.match('var a = 100; return a + 2;', lang_grammar._stms).node;
		//lang_services.Services.pass1(node);
	});
	
	it('js gen', () => {
		var mod = new ir.IrModule();
		var b = new ir.NodeBuilder(mod);
		var TestClass = mod.createClass('Test');
		var demoMethod = TestClass.createMethod('demo', false, b.stms([b.ret(b.int(10))]));
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

    it('run-simple', () => {
		testProgramEvalJs('return 10;', 10);
	});

	it('run-operators', () => {
		testProgramEvalJs('return 10 + 2;', 10 + 2);
        testProgramEvalJs('return 10 * 2;', 10 * 2);
        testProgramEvalJs('return 3 * 5 + 7;', 3 * 5 + 7);
        testProgramEvalJs('return 3 + 5 * 7;', 3 + 5 * 7);
        testProgramEvalJs('return 2 ** 8;', Math.pow(2, 8));
        testProgramEvalJs('return 2 <=> 8;', -1);
        testProgramEvalJs('return 8 <=> 2;', +1);
        testProgramEvalJs('return 3 <=> 3;', 0);
	});
	
	it('run-locals', () => {
		//testProgramJs('var a = 10; return a;', '');
		testProgramEvalJs('var a = 10; return a;', 10);
		testProgramEvalJs('var a = 10, b = 3; return a * b;', 30);
		testProgramEvalJs('var a = 10; a = 7; return a;', 7);
	});

	it('run-if', () => {
		testProgramEvalJs('var a = 10, b = 3; if (a < 7) { b = 2; } return b;', 3);
		testProgramEvalJs('var a = 10, b = 3; if (a > 7) { b = 2; } else { b = 1; } return b;', 2);
	});

	it('run-while', () => {
		testProgramEvalJs('var a = 10; var b = 0; while (a > 0) { a--; b += 3; } return b;', 30);
	});
	
	it('run-scope', () => {
		//testProgramEvalJs('var a = 10; { var a = 7; } return a;', 10);
	});
	
	it('run-range', () => {
		//testProgramEvalJs('return 0 ... 100;', { min: 0, max: 100 });
	});

	it('run-this-access', () => {
		testProgramEvalJs('return this.main == this.main;', true);
	});
	

});
