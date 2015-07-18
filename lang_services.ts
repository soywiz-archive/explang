import vfs = require('./vfs');
import gen_js = require('./gen_js');
import compiler = require('./compiler');
import lang_grammar = require('./lang_grammar');
import _grammar = require('./grammar');
var grammar = new _grammar.Grammar();

export function compile(file:vfs.VfsFile):string {
	var grammarResult = grammar.match(file.readString(), lang_grammar._stms);
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
	return '(function() { ' + gen_js.generateRuntime() + gen_js.generate(compilerResult.module).replace(/\s+/mgi, ' ').trim() + ' return Main.main(); })()';
}