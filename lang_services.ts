import ast = require('./lang_ast');

class EvaluateContext {
	
}

class Type {
	static BOOL = new Type();
	static INT = new Type();
	static FLOAT = new Type();
	static STRING = new Type();
	static UNKNOWN = new Type();
}

class ExpressionResult {
	public constructor(public type:Type, public value:any) {
		
	}
	
	static constant(type:Type, value:any) {
		return new ExpressionResult(type, value);
	}
}

class ExpressionEvaluator {
	static evaluate(context:EvaluateContext, node:ast.PsiElement):ExpressionResult {
		if (node instanceof ast.Int) return ExpressionResult.constant(Type.INT, node.value);
		if (node instanceof ast.Bool) return ExpressionResult.constant(Type.BOOL, node.value);
		if (node instanceof ast.Float) return ExpressionResult.constant(Type.FLOAT, node.value);
		return ExpressionResult.constant(Type.UNKNOWN, null);
	}
}

export class Services {
	static pass1(a:ast.PsiElement) {
		console.log(a.type);
		if (a instanceof ast.If) {
			this.pass1(a.expr);
			this.pass1(a.codeTrue);
			this.pass1(a.codeFalse);
			return;
		}
		if (a instanceof ast.Stms) {
			for (let s of a.children) {
				this.pass1(s);
			}
			return;
		}
		if (a instanceof ast.BinaryOpList) {
			/*
			console.log(a.elements[0].text);
			console.log(a.separators[0].text);
			console.log(a.elements[1].text);
			*/
		}
		if (a instanceof ast.Class) {
			console.log(a.idwg.text);
			return;
		}
		if (a instanceof ast.VarDecls) {
			for (let v of a.vars) {
				this.pass1(v);
			} 
			//console.log(a.vars);
			return;
		}
		if (a instanceof ast.VarDecl) {
			console.log(a.name.text);
			console.log(a.init.text);
			//console.log(a);
			return;
		}
		if (a instanceof ast.Return) {
			console.log('return', a.expr.text);
			return;
		}
		throw 'Unhandled ' + a.type;
	}
}
