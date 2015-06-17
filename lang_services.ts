import ast = require('./lang_ast');

export class Services {
	static pass1(a:ast.PsiElement) {
		if (a instanceof ast.VarDecl) {
		}
		throw 'Unhandled ' + a.type;
	}
}
