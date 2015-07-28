import syntax = require('./syntax');
import vfs = require('./vfs');
import { N, match } from './grammar';
import { classNameOf } from './utils';
import { compile } from './services';

let file = vfs.memoryFile(`
	class Test { }
`);

//console.log('content:', '"', file.readString(), '"');
console.log(compile(file));

/*
function handle(n:N):any {
	if (n instanceof syntax.Expr) {
		return handle(n.it);
	}
	if (n instanceof syntax.BinaryOpList) {
		console.log(classNameOf(n.expressionsRaw));
		console.log(classNameOf(n.operatorsRaw));
		return;
	}
	console.log(`Unhandled ${n._nodeType}`);
}

handle(match(syntax.Expr, '1 + 1[2]').node);
*/