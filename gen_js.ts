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
		if (node instanceof ir.ImmediateExpression) return this.w.write(`${node.value}`);
        if (node instanceof ir.BinOpNode) {
            let type = node.getType();
            switch (type) {
                case ir.Types.Int:
                    this.w.write('((');
                    switch (node.op) {
                        case '**':
                            this.w.write(`Math.pow(`);
                            this.w.action(this.generateNode(node.l));
                            this.w.write(`,`);
                            this.w.action(this.generateNode(node.r));
                            this.w.write(`)`);
                            break;
                        default:
                            this.w.action(this.generateNode(node.l));
                            this.w.write(` ${node.op} `);
                            this.w.action(this.generateNode(node.r));
                            break;
                    }
                    this.w.write(')|0)');
                    break;
                default:
                    throw new Error(`Unhandled type ${type}`);
            }
            //return this.w.write(`${node.value}`);
            return;
        }
		if (node instanceof ir.IdExpression) return this.w.write(`${node.id}`);
		if (node instanceof ir.ExpressionStm) return this.w.action(this.generateNode(node.expression)).writeln(';');
		if (node instanceof ir.CallExpression) {
			this.w.action(this.generateNode(node.left));
			this.w.write('(');
			for (var n = 0; n < node.args.length; n++) {
				if (n != 0) this.w.write(', ');
				this.w.action(this.generateNode(node.args[n]));
			}
			this.w.write(')');
			return this.w;
		}
		
		throw new Error(`Unhandled node ${node}`);
	}
    
    protected generateMethod(method:ir.IrMethod) {
		var name = method.name;
        var className = method.containingClass.name;
		if (method.isStatic) {
			this.w.writeln(`${className}.${name} = function() {`);
		} else {
			this.w.writeln(`${className}.prototype.${name} = function() {`);
		}
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