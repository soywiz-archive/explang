///<reference path="mocha.d.ts" />
///<reference path="../defs.d.ts" />

import grammar = require('../grammar');
import gen_js = require('../gen_js');
import gen_jvm = require('../gen_jvm');
import ir = require('../ir');
import compiler = require('../compiler');
import assert = require("assert"); // node.js core module
import vfs = require('../vfs');
import syntax = require('../syntax');
import services = require('../services');

function testProgramJs(src:string, expectedJs:string) {
	const compilerResult = services.compileProgram(src);
	const generated = gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim();
	assert.equal(expectedJs, generated);
}

function testProgramWithErrors(src:string, expectedError:string) {
	try {
		const compilerResult = services.compileProgram(src);
		const generated = gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim();
	} catch (e) {
		assert.equal(`${e}`, expectedError);
	}
}

function testProgramEvalJs(src:string, expectedResult:any, args:string[] = []) {	
	const compilerResult = services.compileProgram(src);
	let result:any = undefined
	const code = '(function() { ' + gen_js.generateRuntime() + gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim() + ' return Main.main(' + JSON.stringify(args) + '); })()';
	try {
		result = eval(code);
	} catch (e) {
		console.info(code);
		console.error(e);
	}
	
	if (expectedResult != result) {
		console.info(code);
	}
	
	assert.equal(
		expectedResult,
		result
	);
}

vfs.cwd().access('Example.class').write(gen_jvm.generateExample());

describe('test', () => {
	it('simple match', () => {
		assert.equal('true;', grammar.match(syntax.Stms, 'true;').text);
		assert.equal('if (1) ;', grammar.match(syntax.Stms, 'if (1) ;').text);
		assert.equal('while (true) { }', grammar.match(syntax.Stms, 'while (true) { }').text);
		assert.equal('var a = 1;', grammar.match(syntax.Stms, 'var a = 1;').text);
		assert.equal('var a => 1;', grammar.match(syntax.Stms, 'var a => 1;').text);
		assert.equal('if (true) 1; else 2;', grammar.match(syntax.Stms, 'if (true) 1; else 2;').text);
		assert.equal('var a = 3; var b = 4;', grammar.match(syntax.Stms, 'var a = 3; var b = 4;').text);
		
		//var node = grammar.match('if (1 + 1) { }', lang_grammar._stms).node;
		//var node = grammar.match('var a = 100; return a + 2;', lang_grammar._stms).node;
		//lang_services.Services.pass1(node);
	});
	
	it('js gen', () => {
		var mod = new ir.IrModule();
		var b = new ir.NodeBuilder(mod);
		var TestClass = mod.createClass('Test');
		var demoMethod = TestClass.createMethod('demo', ir.Types.Void, ir.IrModifiers.PUBLIC);
		demoMethod.body.add(b.ret(null, b.int(null, 10)));
		assert.equal(
			"var Test = (function () { function Test() { } Test.prototype.demo = function() { return 10; }; return Test; })();",
			gen_js.generate(mod).replace(/\s+/mgi, ' ').trim()
		);
	});

	it('compile', () => {
		testProgramJs(
			'class Test123 { }',
			"var Main = (function () { function Main() { } Main.main = function(argv) { }; return Main; })();var Test123 = (function () { function Test123() { } return Test123; })();"
		);
	});
	
	it('compile2', () => {
		testProgramJs(
			'return;',
			"var Main = (function () { function Main() { } Main.main = function(argv) { return ; }; return Main; })();"
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
		testProgramEvalJs('var a = 10; { var a = 7; } return a;', 10);
	});
	
	it('run-range', () => {
		testProgramEvalJs('var result = 0; for (a in 0 ... 100) result += a; return result;', 4950);
		testProgramEvalJs('var result = 0; for (a in 0 ... 100 * 2) result += a; return result;', 19900);
		testProgramEvalJs('var result = 0; var it = 0 ... 100 * 2; for (a in it) result += a; return result;', 19900);
	});

	it('run-this-access', () => {
		testProgramEvalJs('return this.main == this.main;', true);
	});

	it('run-function', () => {
		testProgramEvalJs('function dup(a:Int):Int => a * 2; return dup(7);', 14);
	});

	it('run-args', () => {
		testProgramEvalJs('return argv[0];', 'a', ['a', 'b']);
		testProgramEvalJs('return argv[2 ** 0];', 'b', ['a', 'b']);
	});
	
	it('infinite-loop-test', () => {
		testProgramWithErrors('return 1', 'Error: ERROR:8:8:Expected: ;');
		testProgramWithErrors('return 1+', 'Error: ERROR:8:12:expected Expr1,ERROR:12:12:Expected: ;');
	});

	it('test return error', () => {
		testProgramWithErrors('function a():Bool => 1; return 1;', `Error: Program had errors [ERROR:18:23:Can't assign Int to Bool]`);
	});
	
	/*
	it('struct decl', () => {
		testProgramEvalJs('struct Point(x:Float, y:Float) { }', 1, ['a', 'b']);
	});
	*/

	it('syntax v2', () => {
		//new lang_desc.For(null, null, null, null);
		//console.log('' + lang_desc.match(lang_desc.Demo2, '1+2').b.element.);
		{
			let res = grammar.match(syntax.Expr, '1+2');
			assert.equal('1+2', res.text);
			assert.equal('Expr', res.nodeType);
		}
		{
			let res = grammar.match(syntax.Stm, 'if (1) 1;');
			assert.equal('if (1) 1;', res.text);
			assert.equal('Stm', res.nodeType);
		}
	});
});
