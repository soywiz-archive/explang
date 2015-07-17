import ir = require('./ir_ast');
import lang = require('./lang_ast');

export class Converter {
	private mod = new ir.IrModule();

	constructor() {
		
	}
	
	convert(e:lang.PsiElement) {
		if (e instanceof lang.Stms) {
			for (let c of e.elements) this.convert(c);
			return;
		}
		if (e instanceof lang.Class) {
			var name = e.idwg.text;
			var clazz = this.mod.createClass(name);
			return;
		}
		throw `Unhandled ${e.type}`;
	}
	
	getModule() {
		return this.mod;
	}
}
