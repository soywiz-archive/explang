import ir = require('./ir_ast');
import { IndentWriter } from './utils';

class Generator {
	private w: IndentWriter = new IndentWriter();
	
	public toString() {
		return this.w.toString();
	}
	
	protected generateNode(node:ir.Node):any {
		if (node == null) return;
		
		if (node instanceof ir.ReturnNode) return this.w.write('return ').action(this.generateNode(node.optValue)).write(';').ln();
		if (node instanceof ir.ImmediateNode) return this.w.write(`${node.value}`);
		
		throw new Error(`Unhandled node ${node}`);
	}
    
    protected generateMethod(method:ir.IrMethod) {
		var name = method.name;
        var className = method.containingClass.name;
		this.w.writeln(`${className}.prototype.${name} = function() {`);
		this.w.indent(() => {
			this.generateNode(method.body);
		});
		this.w.writeln(`};`);
    }
	
	protected generateClass(clazz:ir.IrClass) {
        let name = clazz.name;
		this.w.writeln(`var ${name} = (function () {`);
		this.w.indent(() => {
			this.w.writeln(`function ${name}() {`);
			this.w.writeln(`}`);
            for (let method of clazz.methods) {
                this.generateMethod(method);
            }
            this.w.writeln(`return ${name};`);
		});
		this.w.writeln(`})();`);
	}

	generateModule(module:ir.IrModule) {
		for (let clazz of module.classes) {
			this.generateClass(clazz);
		}
	}
}

export function generate(module:ir.IrModule):string {
	var gen = new Generator();
	gen.generateModule(module);
	return gen.toString();
}