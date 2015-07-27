import vfs = require('./vfs');
import gen_js = require('./gen_js');
import compiler = require('./compiler');
import syntax = require('./syntax');
import grammar = require('./grammar');

export function compile(file:vfs.VfsFile):string {
	var grammarResult = grammar.match(syntax.Stms, file.readString());
	if (!grammarResult.matched) {
		throw new Error(`Not matched ${grammarResult}`);
	}
	if (!grammarResult.eof) {
		throw new Error(`Not end of file ${grammarResult}`);
	}
	var compilerResult = compiler.compile(grammarResult.node);
	if (compilerResult.errors.length > 0) {
		throw new Error(`Program had errors [${compilerResult.errors.join(',')}]`);
	}
	return '(function() { ' + gen_js.generateRuntime() + gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim() + ' return Main.main(); })()';
}